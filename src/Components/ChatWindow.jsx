import React, { useEffect, useRef } from "react";
import { Box, VStack, Text } from "@chakra-ui/react";

function ChatWindow({ messages }) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  return (
    <Box ref={scrollRef} flex={1} w="100%" overflowY="auto" py={6}>
      <VStack w="100%" maxW="720px" mx="auto" spacing={4}>
        {messages.length === 0 ? (
          <Text
            w="100%"
            textAlign="center"
            fontSize="2xl"
            fontWeight="semibold"
          >
            准备好了，随时开始
          </Text>
        ) : (
          messages.map((message) => (
            <Box
              key={message.id}
              alignSelf={message.role === "user" ? "flex-end" : "flex-start"}
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
          ))
        )}
      </VStack>
    </Box>
  );
}

export default ChatWindow;
