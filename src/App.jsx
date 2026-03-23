import React, { useState } from "react";
import { HStack } from "@chakra-ui/react";
import SideBar from "./Components/SideBar";
import ChatPanel from "./Components/ChatPanel";

const DEFAULT_API_BASE =
  import.meta.env.MODE === "production"
    ? "https://ai-interviewer-back.onrender.com"
    : "";
const API_BASE = import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;
const getApiUrl = (path) =>
  API_BASE ? `${API_BASE.replace(/\/$/, "")}${path}` : path;

function App() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [hasSent, setHasSent] = useState(false);

  const handleSend = async () => {
    const nextText = inputValue.trim();
    if (!nextText || isSending) return;
    // 如果用户没发送内容或者正在请求中就退出该函数

    setHasSent(true);
    setIsSending(true);
    setInputValue("");

    const userMessage = { id: Date.now(), role: "user", text: nextText };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);

    try {
      const apiMessages = nextMessages.map((item) => ({
        role: item.role,
        content: item.text,
      }));
      //发送前把本次用户消息追加到历史数组 nextMessages。
      //将历史数组映射成官方文档里的 messages 格式
      //把 messages 数组发给后端

      const assistantId = Date.now() + 1;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", text: "", streaming: true },
      ]);

      const response = await fetch(getApiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: nextText, messages: apiMessages }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            if (parsed.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, text: "请求失败：" + parsed.error, streaming: false }
                    : m,
                ),
              );
              break;
            }
            if (parsed.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, text: m.text + parsed.text }
                    : m,
                ),
              );
            }
          } catch (_) {}
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, streaming: false } : m,
        ),
      );
    } catch (error) {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          // 流式中途断开：在已有内容后追加截断提示
          return prev.map((m) =>
            m.id === last.id
              ? { ...m, text: m.text + "\n\n连接中断，回复可能不完整。", streaming: false }
              : m
          );
        }
        return [
          ...prev,
          { id: Date.now() + 1, role: "assistant", text: "请求失败，请检查后端是否启动。" },
        ];
      });
      console.error("Failed to send chat message:", error);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <HStack h="100vh" spacing={0} bg="#2b2b2b" color="white">
      <SideBar />
      <ChatPanel
        messages={messages}
        inputValue={inputValue}
        onInputChange={(event) => setInputValue(event.target.value)} //把输入框里用户输入的内容同步到 inputValue 状态
        onSend={handleSend}
        hasSent={hasSent}
        isSending={isSending}
      />
    </HStack>
  );
}

export default App;
