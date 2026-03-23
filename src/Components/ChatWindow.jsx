import React, { useEffect, useRef } from "react";
import { Box, HStack, VStack, Text } from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import ReactMarkdown from "react-markdown";

const typingBounce = keyframes`
  0%, 80%, 100% { opacity: 0.2; transform: translateY(0); }
  40% { opacity: 1; transform: translateY(-3px); }
`;

function ChatWindow({ messages, isTyping = false }) {
  const scrollRef = useRef(null);
  const streamingEmpty = messages.some((m) => m.streaming && m.text === "");

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop =
      scrollRef.current.scrollHeight; /* 一旦检测到信息变化，就把滚动条滚到最底部，显示最新消息 */
  }, [messages]);

  return (
    <Box ref={scrollRef} flex={1} w="100%" overflowY="auto" py={6}>
      <VStack w="100%" maxW="720px" mx="auto" spacing={4}>
        {messages.map((message) =>
          message.streaming && message.text === "" ? null : (
            <Box
              key={message.id}
              alignSelf={
                message.role === "user" ? "flex-end" : "flex-start"
              } /*用户消息靠右显示，AI消息靠左显示 */
              bg={message.role === "user" ? "#3f3f3f" : "#2f2f2f"}
              px={4}
              py={3}
              borderRadius="lg"
              maxW="100%"
            >
              {message.role === "assistant" && !message.streaming ? (
                <Box fontSize="sm" color="gray.200" className="markdown-body">
                  <ReactMarkdown>{message.text}</ReactMarkdown>
                </Box>
              ) : (
                <Text fontSize="sm" color="gray.200" whiteSpace="pre-wrap">
                  {message.text}
                </Text>
              )}
            </Box>
          ),
        )}
        {isTyping && streamingEmpty ? (
          <Box
            alignSelf="flex-start"
            bg="#2f2f2f"
            px={4}
            py={3}
            borderRadius="lg"
            maxW="100%"
          >
            <HStack spacing={2}>
              <HStack spacing={1}>
                {["0s", "0.15s", "0.3s"].map((delay) => (
                  <Box
                    key={delay}
                    w="6px"
                    h="6px"
                    borderRadius="full"
                    bg="gray.300"
                    animation={`${typingBounce} 1s ${delay} infinite`}
                    // animation 里用 typingBounce 关键帧，1 秒循环一次，并加上不同延迟
                  />
                ))}
              </HStack>
            </HStack>
          </Box>
        ) : null}
      </VStack>
    </Box>
  );
}

export default ChatWindow;
