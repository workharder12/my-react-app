import React, { useEffect, useRef } from "react";
import { Box, VStack, Text } from "@chakra-ui/react";

function ChatWindow({ messages }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight; /* 一旦检测到信息变化，就把滚动条滚到最底部，显示最新消息 */
  }, [messages]);

  return (
    <Box ref={scrollRef} flex={1} w="100%" overflowY="auto" py={6}>
      <VStack w="100%" maxW="720px" mx="auto" spacing={4}>
        {messages.map((message) => (
          <Box
            key={message.id}
            alignSelf={message.role === "user" ? "flex-end" : "flex-start"}  /*用户消息靠右显示，AI消息靠左显示 */
            bg={message.role === "user" ? "#3f3f3f" : "#2f2f2f"}
            px={4}
            py={3}
            borderRadius="lg"
            maxW="100%"
          >
            <Text fontSize="sm" color="gray.200">
              {message.text}   
            </Text>
          </Box>
        ))}
      </VStack>
    </Box>
  );
}

export default ChatWindow;
