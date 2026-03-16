import React, { useState } from "react";
import { Box, HStack, VStack, Text } from "@chakra-ui/react";
import axios from "axios";
import ChatWindow from "./ChatWindow";
import MessageInput from "./MessageInput";

function Practice() {
  const [messages, setMessages] = useState([
    { id: 1, role: "assistant", text: "你好，有什么可以帮你？" },
    { id: 2, role: "user", text: "请给我一些前端练习建议。" },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    const nextText = inputValue.trim();
    if (!nextText || isSending) return;

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
      <Box
        w={{ base: "72px", md: "260px" }}
        h="100%"
        bg="#1f1f1f"
        borderRight="1px solid"
        borderColor="#2a2a2a"
        px={{ base: 2, md: 4 }}
        py={4}
      >
        <VStack align="stretch" spacing={4} h="100%">
          <HStack spacing={2} color="gray.200">
            <Box w="24px" h="24px" bg="#3a3a3a" borderRadius="full" />
            <Text display={{ base: "none", md: "block" }} fontWeight="bold">
              ChatGPT
            </Text>
          </HStack>
          <VStack align="stretch" spacing={2} color="gray.300" fontSize="sm">
            <HStack spacing={2}>
              <Box w="18px" h="18px" bg="#3a3a3a" borderRadius="sm" />
              <Text display={{ base: "none", md: "block" }}>新聊天</Text>
            </HStack>
            <HStack spacing={2}>
              <Box w="18px" h="18px" bg="#3a3a3a" borderRadius="sm" />
              <Text display={{ base: "none", md: "block" }}>搜索聊天</Text>
            </HStack>
            <HStack spacing={2}>
              <Box w="18px" h="18px" bg="#3a3a3a" borderRadius="sm" />
              <Text display={{ base: "none", md: "block" }}>图片</Text>
            </HStack>
            <HStack spacing={2}>
              <Box w="18px" h="18px" bg="#3a3a3a" borderRadius="sm" />
              <Text display={{ base: "none", md: "block" }}>应用</Text>
            </HStack>
            <HStack spacing={2}>
              <Box w="18px" h="18px" bg="#3a3a3a" borderRadius="sm" />
              <Text display={{ base: "none", md: "block" }}>项目</Text>
            </HStack>
          </VStack>
        </VStack>
      </Box>

      <VStack flex={1} h="100%" spacing={0} px={{ base: 4, md: 8 }}>
        <ChatWindow messages={messages} />
        <MessageInput
          value={inputValue}
          onChange={(event) => setInputValue(event.target.value)}
          onSend={handleSend}
        />
      </VStack>
    </HStack>
  );
}

export default Practice;
