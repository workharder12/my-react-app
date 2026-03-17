import React from "react";
import { VStack, Text } from "@chakra-ui/react";
import ChatWindow from "./ChatWindow";
import MessageInput from "./MessageInput";

function ChatPanel({ messages, inputValue, onInputChange, onSend, hasSent }) {
  return (
    <VStack flex={1} h="100%" spacing={0} px={{ base: 4, md: 8 }}>
      {hasSent ? (
        <>
          <ChatWindow messages={messages} />
          <MessageInput
            value={inputValue}
            onChange={onInputChange}
            onSend={onSend}
          />
        </>
      ) : (
        <VStack
          flex={1}
          w="100%"
          justify="center"
          spacing={6}
          pb={{ base: 52, md: 60 }}
        >
          <Text
            textAlign="center"
            fontSize={{ base: "2xl", md: "3xl" }}
            fontWeight="normal"
            color="white"
            py={4}
            my={4}
          >
            准备好了，随时开始
          </Text>
          <MessageInput
            value={inputValue}
            onChange={onInputChange}
            onSend={onSend}
            isCentered
          />
        </VStack>
      )}
    </VStack>
  );
}

export default ChatPanel;
