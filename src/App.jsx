import React, { useState, useRef, useEffect } from "react";
import { HStack } from "@chakra-ui/react";
import SideBar from "./Components/SideBar";
import ChatPanel from "./Components/ChatPanel";

const DEFAULT_API_BASE =
  import.meta.env.MODE === "production"
    ? "https://ai-interviewer-back.onrender.com"
    : "";
const API_BASE = import.meta.env.VITE_API_BASE || DEFAULT_API_BASE;
const getApiUrl = (path) =>
  API_BASE ? `${API_BASE.replace(/\/$/, "")}${path}` : path;

function App() {
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [hasSent, setHasSent] = useState(false);

  // isSendingRef 是同步锁：state 更新是异步批处理的，同一事件循环内两次点击读到的 isSending 都可能是 false
  // 用 ref 则是同步读写，第一次点击立刻把它设为 true，第二次点击读到的就是 true，竞态彻底消失
  const isSendingRef = useRef(false);
  // abortControllerRef 保存当前请求的控制器，组件卸载或新请求发出时用它来取消旧请求
  const abortControllerRef = useRef(null);

  // 组件卸载时（用户切换路由/关闭页面）自动调用 cleanup
  // 它会调用 abort()，让 fetch 抛出 AbortError，while 循环立刻退出，内存释放
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSend = async () => {
    const nextText = inputValue.trim();
    if (!nextText || isSendingRef.current) return;
    // isSendingRef.current 是同步读取，不存在竞态窗口
    isSendingRef.current = true;

    // 如果上一个请求还没结束（理论上不会，但防御性取消）
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    // 每次发请求都创建一个新的控制器，把它存入 ref 供后续取消使用
    const controller = new AbortController();
    abortControllerRef.current = controller;
    //第一次请求：发出 → 被 abort() 取消 → 进入 finally 收尾
    //第二次请求：取消完第一次后立刻发出 → 正常进行

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

      const assistantId = Date.now() + 1;
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", text: "", streaming: true },
      ]);

      const response = await fetch(getApiUrl("/api/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: nextText, messages: apiMessages }),
        signal: controller.signal,
        // signal 是关键：当 controller.abort() 被调用时，浏览器立刻在网络层切断这个请求
        // fetch 会抛出 AbortError，下面的 reader.read() 也随之 reject，while 循环退出
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            if (parsed.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, text: "请求失败：" + parsed.error, streaming: false }
                    : m,
                ),
              );
              break;
            }
            if (parsed.text) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, text: m.text + parsed.text }
                    : m,
                ),
              );
            }
          } catch (_) {}
        }
      }

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, streaming: false } : m,
        ),
      );
    } catch (error) {
      // AbortError = 用户主动取消（切换路由 / 组件卸载），静默退出，不显示错误提示
      // 此时组件可能已经卸载，不需要也不应该再 setState
      if (error.name === "AbortError") return;

      // 真正的网络错误才展示给用户
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.streaming) {
          // 流式中途断开：在已有内容后追加截断提示
          return prev.map((m) =>
            m.id === last.id
              ? { ...m, text: m.text + "\n\n连接中断，回复可能不完整。", streaming: false }
              : m
          );
        }
        return [
          ...prev,
          { id: Date.now() + 1, role: "assistant", text: "请求失败，请检查后端是否启动。" },
        ];
      });
      console.error("Failed to send chat message:", error);
    } finally {
      // 只有当 ref 还指向本次请求的 controller 时才清理，防止新请求替换后误清
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      //第一次请求死的时候，别把第二次请求的控制器也一起带走。 这是一个防御性检查，保护后来的请求不被误清。
      isSendingRef.current = false;
      //重置同步锁  finally 块的特性保证无论请求成功、报错、还是被取消，这一行都一定会执行
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
