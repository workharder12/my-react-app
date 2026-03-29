# AI-Interviewer 项目文档

## 项目简介

AI-Interviewer 是一个基于智谱 GLM-5 大模型的 AI 模拟面试官应用。用户可以与 AI 进行模拟面试对话，AI 以面试官视角提问并给出反馈，支持流式输出与长对话历史自动压缩。

- **前端**：React 19 + Vite 7，Chakra UI 3，部署于 Vercel
- **后端**：Express 5，部署于 Render（`https://ai-interviewer-back.onrender.com`）
- **AI 模型**：智谱 GLM-5，通过 SSE 流式返回

---

## 目录结构

```
AI-Interviewer/
├── server.js                   # 后端核心：Express API + SSE 流式输出 + 历史压缩
├── vite.config.js              # Vite 配置（开发环境代理 /api → localhost:3001）
├── .env                        # 环境变量（ZHIPU_API_KEY）
├── .env.example                # 环境变量示例
├── package.json
├── public/                     # 静态资源（SVG 图标）
└── src/
    ├── main.jsx                # React 入口，ChakraProvider 包裹
    ├── App.jsx                 # 根组件：全局状态管理 + SSE 数据流消费
    ├── App.css                 # 补充样式（card / avatar / stats）
    ├── index.css               # 全局基础样式
    ├── data.js                 # 占位文件（未使用）
    └── Components/
        ├── SideBar.jsx         # 左侧导航栏（响应式）
        ├── ChatPanel.jsx       # 主区域：欢迎页 / 聊天页切换
        ├── ChatWindow.jsx      # 消息列表：流式渲染 + Markdown + 打字动画
        └── MessageInput.jsx    # 输入框：自适应高度 + Enter 发送 + Shift+Enter 换行
```

---

## 核心模块说明

### 1. `server.js` — 后端 API

- **端口**：3001
- **速率限制**：每 IP 每分钟最多 10 次请求
- **最大并发**：20
- **Token 阈值**：46848（触发历史压缩，约为 128K 上下文的 75%）

| 端点 | 方法 | 说明 |
|------|------|------|
| `/` | GET | 健康检查 |
| `/api/chat` | POST | 聊天接口，SSE 流式输出 |

**历史压缩机制**：当累计 token 超过阈值时，自动调用 GLM-5 将历史对话压缩为一段中文摘要（≤200 字，面试官视角），并保留最近 8 条消息，以此控制 context window。

---

### 2. `src/App.jsx` — 全局状态管理

| 状态 | 类型 | 说明 |
|------|------|------|
| `messages` | Array | 完整对话历史 |
| `inputValue` | String | 当前输入内容 |
| `isSending` | Boolean | 请求进行中 |
| `hasSent` | Boolean | 是否已发过消息（控制页面切换） |

消息数据结构：
```js
{ id: number, role: "user" | "assistant", text: string, streaming?: boolean }
```

---

### 3. `src/Components/ChatWindow.jsx` — 消息渲染

- 用户消息：右对齐，纯文本
- AI 消息（完成态）：左对齐，`ReactMarkdown` 渲染
- AI 消息（流式中）：左对齐，纯文本实时追加，末尾显示三点跳动动画
- 新消息到来时自动滚动到底部

---

### 4. `src/Components/MessageInput.jsx` — 输入框

- 单行：高度 56px，圆角 28px
- 多行：内容超出时自动扩展，最高 168px
- `Enter` 发送，`Shift+Enter` 换行
- 请求进行中禁用输入

---

### 5. `src/Components/ChatPanel.jsx` — 布局切换

- `hasSent === false`：显示欢迎页，输入框居中
- `hasSent === true`：显示 `ChatWindow` + 底部固定 `MessageInput`

---

### 6. `src/Components/SideBar.jsx` — 左侧导航

- 响应式：小屏仅图标，中屏及以上显示文字标签
- 包含：新聊天 / 搜索 / 设置（当前为 UI 占位，无实际逻辑）
- 底部用户登录区域（UI 占位）

---

## 系统架构与数据流

```
┌─────────────────────────────────────────────────────────────────────┐
│                           前端 (React + Vite)                        │
│                                                                       │
│   SideBar          ChatPanel                                          │
│   ─────────        ──────────────────────────────────────────        │
│   新聊天           hasSent=false → 欢迎页 + 居中输入框               │
│   搜索             hasSent=true  → ChatWindow + 底部 MessageInput    │
│   设置                                                                │
│                                                                       │
│   App.jsx (状态管理)                                                  │
│   ┌──────────────────────────────────────────────┐                   │
│   │  messages[]  isSending  hasSent  inputValue  │                   │
│   └──────────────────────────────────────────────┘                   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ fetch POST /api/chat
                               │ { message, messages[] }
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        后端 (Express / server.js)                    │
│                                                                       │
│   POST /api/chat                                                      │
│   ─────────────                                                       │
│   1. 规范化消息数组                                                   │
│   2. gpt-tokenizer 计算总 token 数                                   │
│   3. token > 46848 ?                                                  │
│      ├── YES → 调用 GLM-5 生成摘要（≤200字）                        │
│      │         压缩为 [system:摘要] + 最近8条消息                    │
│      └── NO  → 直接使用完整历史                                      │
│   4. axios.post(智谱 API, { stream: true })                          │
│   5. 逐块解析 SSE，提取 delta.content                               │
│   6. 写入响应：data: {"text": "..."}                                │
│   7. 结束：data: [DONE]                                              │
└──────────────────────────────┬──────────────────────────────────────┘
                               │ axios stream
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     智谱 AI API (GLM-5)                              │
│          https://open.bigmodel.cn/api/paas/v4/chat/completions       │
└─────────────────────────────────────────────────────────────────────┘
```

### SSE 消费详细流程

```
用户输入 → MessageInput.onSend()
    ↓
App.handleSend()
    ├── setMessages(...追加 user 消息)
    ├── setMessages(...追加 streaming:true 的 assistant 占位消息)
    └── fetch POST /api/chat
          ↓ (开发环境经 Vite 代理转发)
        server.js 处理并返回 SSE 流
          ↓
        ReadableStream 逐块解析
          ├── 解析每条 data: {"text": "..."}
          ├── 累加到 assistant 消息的 text 字段
          └── 收到 [DONE] → streaming: false
    ↓
ChatWindow 渲染：streaming=false 时用 ReactMarkdown 渲染
```

---

## 模块协作关系

```
┌──────────────────────────────────────────────────────┐
│                     App.jsx                          │
│  （状态中枢：持有 messages / isSending / hasSent）   │
│                                                      │
│  ┌────────────┐    ┌────────────────────────────┐   │
│  │  SideBar   │    │        ChatPanel            │   │
│  │  （导航）  │    │  ┌──────────────────────┐  │   │
│  │            │    │  │    ChatWindow         │  │   │
│  │  props:    │    │  │  （读 messages[]）    │  │   │
│  │  （无）    │    │  └──────────────────────┘  │   │
│  │            │    │  ┌──────────────────────┐  │   │
│  │            │    │  │   MessageInput        │  │   │
│  │            │    │  │  （写 inputValue,     │  │   │
│  │            │    │  │   触发 handleSend）   │  │   │
│  │            │    │  └──────────────────────┘  │   │
│  └────────────┘    └────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
        │                        │
        │ 状态向下单向流动        │
        ▼                        ▼
   无状态展示              事件向上回调
   (读 props)           (调用 onSend 等回调)
```

---
用户输入
  ↓
前端 fetch (POST, 带历史)
  ↓
server.js
  ├─ token 超阈值 → 先压缩历史
  └─ axios stream → 智谱 GLM-5
                        ↓ 逐块返回
  ← data: {"text":"你"} ←
  ← data: {"text":"好"} ←
  ← data: [DONE]        ←
  ↓
前端逐块解析，实时追加到消息
  ↓
streaming: false → Markdown 渲染完毕


## 环境变量

| 变量名 | 位置 | 说明 |
|--------|------|------|
| `ZHIPU_API_KEY` | 后端 `.env` | 智谱 AI API 密钥 |
| `VITE_API_BASE` | 前端 `.env` | 覆盖默认 API 地址（可选） |

**API 地址逻辑**（`src/App.jsx`）：
- 开发环境：`/api`（Vite 代理到 `localhost:3001`）
- 生产环境：`https://ai-interviewer-back.onrender.com`
- 若设置 `VITE_API_BASE`，则优先使用该变量

---

## 开发命令

```bash
# 安装依赖
npm install

# 启动前端开发服务器（含代理）
npm run dev

# 启动后端服务（需另开终端）
npm run server

# 构建生产包
npm run build

# 预览生产构建
npm run preview

# ESLint 检查
npm run lint
```

> 本地开发需同时运行 `npm run dev` 和 `npm run server`，前端通过 Vite 代理自动转发 `/api` 请求到后端。

---

## 待完善功能

- SideBar 中的「新聊天」「搜索」「设置」按钮：仅 UI，无实际逻辑
- 底部用户登录区域：UI 占位，无认证系统
- MessageInput 左侧「+」按钮：附件/扩展功能预留，未实现
- `src/data.js`：空文件，未使用
