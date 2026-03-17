import React from "react";
import { Box, HStack, VStack, Text } from "@chakra-ui/react";

const NAV_ITEMS = [
  { id: "new", label: "新聊天", icon: "/xinliaotian2.svg" },
  { id: "search", label: "搜索", icon: "/sousuo.svg" },
  { id: "settings", label: "设置", icon: "/shezhi.svg" },
];

const ICON_SIZE = "20px";
const ICON_FILTER = "brightness(0) invert(0.8)"; // 统一图标颜色

function SideBar() {
  return (
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
          <Box
            as="img" /*把box当成img标签来使用 */
            src="/aimonimianshiguan.svg"
            alt="AI-Interviewer"
            w={ICON_SIZE}
            h={ICON_SIZE}
            filter={ICON_FILTER}
          />
          <Text display={{ base: "none", md: "block" }} fontWeight="bold">
            {/* 字体加粗.小屏幕隐藏文本,中屏幕显示 */}
            AI-Interviewer
          </Text>
        </HStack>
        <VStack align="stretch" spacing={2} color="gray.200" fontSize="sm"> 
          {/* align控制交叉轴方向,justify控制同轴,vstack的flex方向默认为纵轴,align则控制横轴 */}
          {NAV_ITEMS.map((item) => (
            <HStack key={item.id} spacing={2}>
              <Box
                as="img"
                src={item.icon}
                alt=""
                w={ICON_SIZE}
                h={ICON_SIZE}
                filter={ICON_FILTER}
              />
              <Text display={{ base: "none", md: "block" }}>{item.label}</Text>
            </HStack>
          ))}
        </VStack>

        <VStack
          mt="auto" 
          // 因为vstack整体为纵向flex容器,所以margin-top: auto 会把这个元素的上方空间全部吃掉，所以它会被“挤”到最底部，看起来像是自动贴底。
          align="stretch"
          spacing={2}
          pt={4}
          borderTop="1px solid"
          borderColor="#2a2a2a"
        >
          <HStack spacing={2} color="gray.200" fontSize="sm">
            <Box
              w={ICON_SIZE}
              h={ICON_SIZE}
              borderRadius="full"
              border="1px dashed"
              borderColor="gray.500"
            />
            <Text display={{ base: "none", md: "block" }}>用户登录</Text>
          </HStack>
        </VStack>
      </VStack>
    </Box>
  );
}

export default SideBar;
