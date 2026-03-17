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

      const response = await axios.post(
        "/api/chat",
        { message: nextText, messages: apiMessages },
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
          // 如果 result.reply 有值，就用它作为回复内容；否则再去看 result.data.message，最后才用默认文案。
          // 这样写的好处是：后端返回结构变了也不容易报错。

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
        onInputChange={(event) => setInputValue(event.target.value)} //把输入框里用户输入的内容同步到 inputValue 状态
        onSend={handleSend}
        hasSent={hasSent}
        isSending={isSending}
      />
    </HStack>
  );
}

export default App;
