import React, { useState } from "react";
import { HStack } from "@chakra-ui/react";
import axios from "axios";
import SideBar from "./Components/SideBar";
import ChatPanel from "./Components/ChatPanel";

function App() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [hasSent, setHasSent] = useState(false);

  const handleSend = async () => {
    const nextText = inputValue.trim();
    if (!nextText || isSending) return;

    setHasSent(true);
    setIsSending(true);
    setInputValue("");

    const userMessage = { id: Date.now(), role: "user", text: nextText };
    setMessages((prev) => [...prev, userMessage]);

    try {
      const response = await axios.post(
        "/api/chat",
        { message: nextText },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const result = response.data;
      const replyText = result?.reply
        ? result.reply
        : result?.data?.message
          ? `后端已收到: ${result.data.message}`
          : "后端已收到你的消息。";

      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", text: replyText },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          role: "assistant",
          text: "请求失败，请检查后端是否启动。",
        },
      ]);
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
        onInputChange={(event) => setInputValue(event.target.value)}
        onSend={handleSend}
        hasSent={hasSent}
      />
    </HStack>
  );
}

export default App;
