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
        //如果你传了 messages，它就把里面不合格的删掉（比如没有 role、没有 content、内容是空的）
  if (
    normalizedMessages.length === 0 &&
    (!message || typeof message !== "string" || !message.trim())
    //然后把内容两边的空格去掉，变成'干净的对话数组
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

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

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
      },
    );

    glmResponse.data.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const json = line.slice(5).trim();
        if (json === '[DONE]') {
          res.write('data: [DONE]\n\n');
          return;
        }
        try {
          const parsed = JSON.parse(json);
          const raw = parsed.choices?.[0]?.delta?.content;
          const text = Array.isArray(raw)
            ? raw.map((i) => (typeof i === 'string' ? i : i?.text || '')).join('')
            : typeof raw === 'string'
              ? raw
              : '';
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        } catch (_) {
          // 忽略非 JSON 行
        }
      }
    });

    glmResponse.data.on('end', () => {
      res.write('data: [DONE]\n\n');
      res.end();
      activeRequests--;
    });

    glmResponse.data.on('error', (err) => {
      console.error('GLM-5 stream error:', err.message);
      res.end();
      activeRequests--;
    });
  } catch (error) {
    const apiError =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      'Failed to call GLM-5 API';

    console.error('GLM-5 API error:', error.response?.data || error.message);

    res.write(`data: ${JSON.stringify({ error: apiError })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
    activeRequests--;
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
