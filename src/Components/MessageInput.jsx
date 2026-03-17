import React, { useEffect, useRef, useState } from "react";
import { Box, HStack, Button } from "@chakra-ui/react";

function MessageInput({ value, onChange, onSend, isCentered = false }) {
  const textAreaRef = useRef(null);
  const [isMultiline, setIsMultiline] = useState(false);
  const singleLineHeight = 24;
  const maxTextAreaHeight = 168;

  useEffect(() => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    textarea.style.height = "0px";
    const nextHeight = Math.min(
      Math.max(textarea.scrollHeight, singleLineHeight),
      maxTextAreaHeight,
    );
    textarea.style.height = `${nextHeight}px`;

    const visualLineCount = Math.ceil(textarea.scrollHeight / singleLineHeight);
    setIsMultiline(value.length > 0 && visualLineCount > 1);
  }, [value]);

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  };

  const commonTextAreaProps = {
    ref: textAreaRef,
    as: "textarea",
    border: "none",
    outline: "none",
    resize: "none",
    lineHeight: "24px",
    minH: "24px",
    maxH: "168px",
    overflowY: "auto",
    bg: "transparent",
    color: "white",
    fontSize: "18px",
    fontWeight: "500",
    placeholder: "有问题，尽管问",
    value,
    onChange,
    onKeyDown: handleKeyDown,
    _placeholder: { color: "gray.300", fontSize: "18px", fontWeight: "400" },
    sx: {
      overflowWrap: "anywhere",
      wordBreak: "break-word",
    },
  };

  const actionBtnStyle = {
    h: "40px",
    borderRadius: "xl",
    bg: "#34363a",
    color: "white",
    _hover: { bg: "#1a1d21" },
  };

  return (
    <Box w="100%" pb={isCentered ? 0 : 8}>
      <Box
        w="100%"
        maxW="720px"
        mx="auto"
        px={isMultiline ? 6 : 2}
        py={isMultiline ? 4 : 2}
        bg="#34363a"
        borderRadius="28px"
        minH={isMultiline ? "128px" : "56px"}
        transition="padding 0.32s cubic-bezier(0.22, 1, 0.36, 1), border-radius 0.32s cubic-bezier(0.22, 1, 0.36, 1), min-height 0.32s cubic-bezier(0.22, 1, 0.36, 1)"
      >
        <Box
          display="grid"
          gridTemplateColumns="auto minmax(0, 1fr) auto"
          gridTemplateRows={isMultiline ? "auto auto" : "auto"}
          columnGap={2}
          rowGap={isMultiline ? 3 : 0}
          alignItems={isMultiline ? "end" : "center"}
          transition="row-gap 0.32s cubic-bezier(0.22, 1, 0.36, 1)"
        >
          <Button
            {...actionBtnStyle}
            minW="40px"
            px={0}
            gridColumn="1"
            gridRow={isMultiline ? "2" : "1"}
            alignSelf="end"
            transition="transform 0.32s cubic-bezier(0.22, 1, 0.36, 1)"
          >
            +
          </Button>

          <Box
            {...commonTextAreaProps}
            w={isMultiline ? "100%" : "auto"}
            py={isMultiline ? "2px" : "0"}
            gridColumn={isMultiline ? "1 / -1" : "2"}
            gridRow="1"
          />

          <HStack
            spacing={2}
            gridColumn="3"
            gridRow={isMultiline ? "2" : "1"}
            justifySelf="end"
            alignSelf="end"
          >
            <Button
              {...actionBtnStyle}
              minW={isMultiline ? "52px" : "110px"}
              px={isMultiline ? 0 : undefined}
              onClick={onSend}
            >
              {isMultiline ? "发送" : "发送"}
            </Button>
          </HStack>
        </Box>
      </Box>
    </Box>
  );
}

export default MessageInput;
