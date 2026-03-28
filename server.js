import "dotenv/config";
import express from "express";
import cors from "cors";
import axios from "axios";
import rateLimit from "express-rate-limit";
import { encode } from "gpt-tokenizer";

const app = express();
const PORT = process.env.PORT || 3001;
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

const MAX_CONCURRENT = 20;
let activeRequests = 0;

// 统一管理并发槽的释放，避免在多个地方散落 activeRequests--
function releaseSlot() {
  if (activeRequests > 0) activeRequests--;
}

const TOKEN_THRESHOLD = 46848; // 75% of (128000 - 65536)
const RECENT_MESSAGES_KEEP = 8;

function countMessagesTokens(messages) {
  return messages.reduce((sum, msg) => {
    return sum + encode(msg.role).length + encode(msg.content).length + 4;
  }, 0);
}

async function summarizeHistory(messages) {
  const summaryPrompt = [
    {
      role: "user",
      content:
        "你是一名专业的技术面试记录员。请根据以下对话历史，用中文生成一段简洁的面试进展摘要，格式要求：" +
        "1. 面试官已询问了哪些技术问题（列举具体问题）；" +
        "2. 候选人展现出对哪些技术的掌握；" +
        "3. 哪些方面尚待深入挖掘。" +
        "摘要控制在200字以内，保持面试官视角。\n\n对话历史：\n" +
        messages
          .map((m) => `${m.role === "user" ? "候选人" : "面试官"}：${m.content}`)
          .join("\n"),
    },
  ];

  const resp = await axios.post(
    ZHIPU_BASE_URL,
    {
      model: "glm-5",
      messages: summaryPrompt,
      max_tokens: 512,
      temperature: 0.3,
    },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZHIPU_API_KEY}`,
      },
      timeout: 30000,
    },
  );

  const raw = resp.data?.choices?.[0]?.message?.content;
  const text = Array.isArray(raw)
    ? raw
        .map((item) => (typeof item === "string" ? item : item?.text || ""))
        .join("")
        .trim()
    : typeof raw === "string"
      ? raw.trim()
      : "";
  return text;
}

app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
);
// cors 中间件允许前端跨域访问后端。
// origin 这里用 isAllowedOrigin 做白名单判断，只有允许的域名才能访问,这里改为全域访问
// methods 限定允许的请求方式。
// credentials: true 允许携带 cookie 等凭证。

app.use(express.json());

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "请求过于频繁，请一分钟后再试" },
});

app.get("/", (req, res) => {
  res.send("Express server is running.");
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  if (activeRequests >= MAX_CONCURRENT) {
    return res.status(503).json({ error: "服务繁忙，请稍后重试" });
  }
  activeRequests++;

  const { message, messages } = req.body ?? {};

  const normalizedMessages = Array.isArray(messages)
    ? messages
        .filter(
          (item) =>
            item &&
            typeof item.role === "string" &&
            typeof item.content === "string" &&
            item.content.trim(),
        )
        .map((item) => ({
          role: item.role,
          content: item.content.trim(),
        }))
    : [];
        //.filter是过滤无效信息,保留满足以下全部条件的信息,item存在并且item.role和item.content是字符串类型,并且content非空
        //.map提取标准字段,每条消息只保留role和content字段,丢弃其他多余字段
        //兜底处理:如果messages不是数组就返回空数组
  if (
    normalizedMessages.length === 0 &&
    (!message || typeof message !== "string" || !message.trim())
    
  ) {
    return res
      .status(400)
      .json({ error: "message or messages is required" });
  }
  //如果都为空,则回复400状态码以及出错

  const payloadMessages =
    normalizedMessages.length > 0
      ? normalizedMessages
      : [
          {
            role: "user",
            content: message.trim(),
          },
        ];
        //先决定到底用哪份消息发给大模型：
        //如果你传了完整对话数组（normalizedMessages 里有内容），就用它。
        //如果没有，就退回去用单条 message，把它包装成一条'用户消息'。

  if (!ZHIPU_API_KEY) {
    return res.status(500).json({ error: "Missing ZHIPU_API_KEY in .env" });
  }

  let finalMessages = payloadMessages;
  if (countMessagesTokens(payloadMessages) >= TOKEN_THRESHOLD) {
    try {
      const summary = await summarizeHistory(payloadMessages);
      if (summary) {
        const recentMessages = payloadMessages.slice(-RECENT_MESSAGES_KEEP);
        finalMessages = [
          { role: "system", content: `【面试进展摘要】${summary}` },
          ...recentMessages,
        ];
        console.log(`[Token Monitor] 触发摘要压缩，原始消息数: ${payloadMessages.length}，压缩后: ${finalMessages.length}`);
      }
    } catch (summaryError) {
      console.error("[Token Monitor] 摘要生成失败，降级使用原始消息:", summaryError.message);
    }
  }
  //初始化SSE连接
  res.setHeader('Content-Type', 'text/event-stream');//告诉浏览器这是 SSE 流，不是普通 HTTP 响应
  res.setHeader('Cache-Control', 'no-cache');//禁止代理/浏览器缓存，确保每块数据实时到达客户端
  res.setHeader('Connection', 'keep-alive');//保持 TCP 连接不断开，让服务端可以持续推送数据
  res.flushHeaders();//立即将响应头发送给客户端，不等待响应体。这样客户端可以马上知道「连接已建立，等待数据」

  // axiosController 用于取消对智谱 API 的 axios 请求
  // 当前端断开连接时，我们通过它来中止已经发出的 HTTP 流请求，避免继续消耗 Token
  const axiosController = new AbortController();
  // clientAborted 是一个标志位，防止前端断开后 data 事件里的残余回调继续向已关闭的 res 写数据
  let clientAborted = false;

  // req.on('close') 是 Node.js 的原生事件：当客户端（浏览器）关闭连接时触发
  // 无论是用户关闭标签页、切换路由、还是前端调用了 AbortController.abort()，这里都会触发
  req.on('close', () => {
    clientAborted = true;             // 置标志，阻断后续 data 回调继续写 res
    axiosController.abort();          // 向智谱 API 发出取消信号，axios 流立刻中止，不再消耗 Token
    releaseSlot();                    // 释放并发槽，让下一个用户的请求可以进来
  });

  try {
    const glmResponse = await axios.post(
      ZHIPU_BASE_URL,
      {
        model: 'glm-5',
        messages: finalMessages,
        thinking: {
          type: 'enabled',
        },
        max_tokens: 65536,
        temperature: 1.0,
        stream: true,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ZHIPU_API_KEY}`,
        },
        timeout: 60000,
        responseType: 'stream',
        signal: axiosController.signal,
        // signal 挂载到 axios：当 axiosController.abort() 被调用时，axios 立刻中断这个 HTTP 请求
        // 智谱 API 的 TCP 连接被关闭，不再有新的 Token 被消耗
      },
    );

    glmResponse.data.on('data', (chunk) => {
      // clientAborted=true 说明前端已断开，axios 流虽然可能还有残余 data 事件在队列里
      // 这里提前短路，不再尝试向已关闭的 res 写数据，避免 write after end 错误
      if (clientAborted) return;
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const json = line.slice(5).trim();//slice(5)表示从第五个字符开始,包括第五个字符
        if (json === '[DONE]') {
          res.write('data: [DONE]\n\n');
          return;
        }
        try {
          const parsed = JSON.parse(json);
          const raw = parsed.choices?.[0]?.delta?.content;
          //把 JSON 字符串解析成对象，然后从里面找到这次新增的文字内容（delta.content 就是 AI 这一步新说的话）。
          const text = Array.isArray(raw)
            ? raw.map((i) => (typeof i === 'string' ? i : i?.text || '')).join('')
            : typeof raw === 'string'
              ? raw
              : '';
              //智谱 API 返回的内容格式不太统一——有时候是一个字符串，有时候是一个数组。
              // 这里做了兼容：是数组就拼接，是字符串就直接用，啥都不是就给个空字符串。
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        } catch (_) {
          // 如果某行解析 JSON 出错，静默忽略，继续处理下一行。
        }
      }
    });

    glmResponse.data.on('end', () => {
      if (clientAborted) return; // 前端已断开，res 早已关闭，不重复操作
      res.write('data: [DONE]\n\n');
      res.end();
      releaseSlot();
    });
    //流结束了，再发一次 [DONE] 保险，然后关闭连接，把「当前并发数」减一，腾出位置给下一个用户。
    glmResponse.data.on('error', (err) => {
      if (clientAborted) return;
      console.error('GLM-5 stream error:', err.message);
      res.end();
      releaseSlot();
    });
    //流传输出错，打印错误日志，强制关闭连接，释放并发槽。
  } catch (error) {
    // axios 被 abort() 取消时抛出的错误码是 ERR_CANCELED
    // 这是我们主动取消的，不是真正的 API 故障，静默处理即可
    if (error.code === 'ERR_CANCELED' || error.name === 'CanceledError') return;

    const apiError =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'Failed to call GLM-5 API';
      //如果 axios 发请求就失败了（比如网络断了、API Key 错了），按优先级从错误对象里找最有用的那条错误描述。

    console.error('GLM-5 API error:', error.response?.data || error.message);

    if (!clientAborted) {
      res.write(`data: ${JSON.stringify({ error: apiError })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
    releaseSlot();
    //把错误信息发给前端，再发结束信号，关闭连接，释放并发槽。
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
