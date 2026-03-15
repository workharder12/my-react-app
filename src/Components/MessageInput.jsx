import React from "react";
import { Box, HStack, Input, Button } from "@chakra-ui/react";

function MessageInput({ value, onChange, onSend }) {
  return (
    <Box w="100%" pb={8}>
      <HStack
        w="100%"
        maxW="720px"
        mx="auto"
        px={3}
        py={2}
        bg="#3a3a3a"
        borderRadius="full"
        spacing={2}
        alignItems="center"
      >
        <Button
          size="sm"
          variant="ghost"
          color="white"
          _hover={{ bg: "#4a4a4a" }}
        >
          +
        </Button>
        <Input
          flex={1}
          variant="unstyled"
          placeholder="有问题，尽管问"
          value={value}
          onChange={onChange}
          _placeholder={{ color: "gray.300" }}
        />
        <HStack spacing={1}>
          <Button
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: "#4a4a4a" }}
          >
            mic
          </Button>
          <Button
            size="sm"
            variant="ghost"
            color="white"
            _hover={{ bg: "#4a4a4a" }}
            onClick={onSend}
          >
            发送
          </Button>
        </HStack>
      </HStack>
    </Box>
  );
}

export default MessageInput;
