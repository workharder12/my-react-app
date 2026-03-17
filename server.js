import "dotenv/config";
import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3001;
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

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

app.get("/", (req, res) => {
  res.send("Express server is running.");
});

app.post("/api/chat", async (req, res) => {
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
    //然后把内容两边的空格去掉，变成“干净的对话数组
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
        //如果没有，就退回去用单条 message，把它包装成一条“用户消息”。

  if (!ZHIPU_API_KEY) {
    return res.status(500).json({ error: "Missing ZHIPU_API_KEY in .env" });
  }

  try {
    const glmResponse = await axios.post(
      ZHIPU_BASE_URL,
      {
        model: "glm-5",
        messages: payloadMessages,
        thinking: {
          type: "enabled",
        },
        max_tokens: 65536,
        temperature: 1.0,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ZHIPU_API_KEY}`,
        },
        timeout: 60000,
      },
    );

    const content = glmResponse.data?.choices?.[0]?.message?.content;
    //.choices?.[0]
    // 大模型通常会返回一个 choices 数组，这里取第一个回复。
    // ?. 是“可选链”，意思是如果 choices 不存在，不会报错，只会返回 undefined。
    const reply = Array.isArray(content)
      ? content
          .map((item) => (typeof item === "string" ? item : item?.text || ""))
          .join("")
          .trim()
      : typeof content === "string"
        ? content.trim()
        : "";
        //先从大模型返回结果里取内容
        //去找 choices[0].message.content，如果哪一层没有就当它是空的。
        //如果 content 是数组,就把每一段拼起来
        //如果 content 是字符串，就直接用它
        //如果啥都不是，就给一个空字符串。

    return res.status(200).json({
      reply: reply || "模型未返回可解析的文本内容。",
    });
  } catch (error) {
    const apiError =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      "Failed to call GLM-5 API";

    console.error("GLM-5 API error:", error.response?.data || error.message);

    return res.status(500).json({
      error: apiError,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
