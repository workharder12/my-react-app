import axios from "axios";
import { encode } from "gpt-tokenizer";

const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

const TOKEN_THRESHOLD = 46848;
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
    { model: "glm-5", messages: summaryPrompt, max_tokens: 512, temperature: 0.3 },
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ZHIPU_API_KEY}`,
      },
      timeout: 30000,
    }
  );

  const raw = resp.data?.choices?.[0]?.message?.content;
  const text = Array.isArray(raw)
    ? raw.map((item) => (typeof item === "string" ? item : item?.text || "")).join("").trim()
    : typeof raw === "string"
    ? raw.trim()
    : "";
  return text;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { message, messages } = req.body ?? {};

  const normalizedMessages = Array.isArray(messages)
    ? messages
        .filter(
          (item) =>
            item &&
            typeof item.role === "string" &&
            typeof item.content === "string" &&
            item.content.trim()
        )
        .map((item) => ({ role: item.role, content: item.content.trim() }))
    : [];

  if (normalizedMessages.length === 0 || !message?.trim()) {
    return res.status(400).json({ error: "消息不能为空" });
  }

  const systemPrompt = {
    role: "system",
    content:
      "你是一位经验丰富的技术面试官，正在对候选人进行技术面试。你的职责是：1. 针对候选人的回答提出深入的追问；2. 评估候选人的技术深度和广度；3. 保持专业、客观的态度；4. 适时给出建设性的反馈。请用中文进行面试。",
  };

  let finalMessages = normalizedMessages;

  try {
    const totalTokens = countMessagesTokens(normalizedMessages);
    if (totalTokens > TOKEN_THRESHOLD) {
      const recentMessages = normalizedMessages.slice(-RECENT_MESSAGES_KEEP);
      const oldMessages = normalizedMessages.slice(0, -RECENT_MESSAGES_KEEP);
      if (oldMessages.length > 0) {
        const summary = await summarizeHistory(oldMessages);
        if (summary) {
          finalMessages = [
            { role: "system", content: `【面试进展摘要】${summary}` },
            ...recentMessages,
          ];
        } else {
          finalMessages = recentMessages;
        }
      }
    }
  } catch (e) {
    console.error("History compression failed:", e.message);
  }

  const messagesWithSystem = [systemPrompt, ...finalMessages];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const glmResponse = await axios.post(
      ZHIPU_BASE_URL,
      {
        model: "glm-5",
        messages: messagesWithSystem,
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ZHIPU_API_KEY}`,
        },
        responseType: "stream",
        timeout: 60000,
      }
    );

    let buffer = "";
    glmResponse.data.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const jsonStr = trimmed.slice(5).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const raw = parsed?.choices?.[0]?.delta?.content;
          const text = Array.isArray(raw)
            ? raw.map((i) => (typeof i === "string" ? i : i?.text || "")).join("")
            : typeof raw === "string"
            ? raw
            : "";
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        } catch (_) {}
      }
    });

    glmResponse.data.on("end", () => {
      res.write("data: [DONE]\n\n");
      res.end();
    });

    glmResponse.data.on("error", (err) => {
      console.error("GLM-5 stream error:", err.message);
      res.end();
    });
  } catch (error) {
    const apiError =
      error.response?.data?.error?.message ||
      error.response?.data?.message ||
      error.message ||
      "Failed to call GLM-5 API";
    console.error("GLM-5 API error:", apiError);
    res.write(`data: ${JSON.stringify({ error: apiError })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
}
