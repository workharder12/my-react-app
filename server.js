import "dotenv/config";
import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3001;
const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY;
const ZHIPU_BASE_URL = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;

  // Allow local development ports such as 5174/5175 when Vite auto-switches.
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);
};

app.use(
  cors({
    origin(origin, callback) {
      callback(null, isAllowedOrigin(origin));
    },
    methods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  }),
);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Express server is running.");
});

app.post("/api/chat", async (req, res) => {
  const { message } = req.body ?? {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  if (!ZHIPU_API_KEY) {
    return res.status(500).json({ error: "Missing ZHIPU_API_KEY in .env" });
  }

  try {
    const glmResponse = await axios.post(
      ZHIPU_BASE_URL,
      {
        model: "glm-5",
        messages: [
          {
            role: "user",
            content: message,
          },
        ],
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
    const reply = Array.isArray(content)
      ? content
          .map((item) => (typeof item === "string" ? item : item?.text || ""))
          .join("")
          .trim()
      : typeof content === "string"
        ? content.trim()
        : "";

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
