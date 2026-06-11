# AI Prompt Manager → Chrome 扩展改造规划

> 版本: v3.0 | 日期: 2026-06-11 | 状态: 第 8 节已评审修正

> **v2.0 修正摘要**（基于第一次专家评审）：
> - ❌→✅ 纠正：`dangerouslyAllowBrowser: true` 必须保留
> - ❌→✅ 修复：`popup.tsx` JSX style 语法错误
> - ❌→✅ 补充：遗漏项若干

> **v3.0 修正摘要**（基于第二次专家评审—第 8 节一键插入）：
> - ❌→✅ **变量语法统一**：删除自定义 `|` 管道语法，复用现有 `extractVariables` + `renderTemplate` + `VariableForm`
> - ❌→✅ **插入策略改为分层**：Clipboard API 模拟粘贴（首选）→ ProseMirror 专用 API → textContent 兜底
> - ❌→✅ **Content Script IIFE 格式**：增加构建格式警告，推荐 `vite-plugin-web-extension`
> - ❌→✅ **标签页加载重试**：`setTimeout 2s` → 指数退避重试 + CONTENT_SCRIPT_READY 协议
> - ❌→✅ **多标签页选择**：增加标签页选择 UI 设计方案
> - ❌→✅ **host_permissions 优化**：AI 平台域名改为 `optional_host_permissions`，按需申请
> - ❌→✅ **DOM 选择器改进**：增加多级 fallback + 启发式通用查找器 + 区域域名通配
> - ❌→✅ **边角情况补充**：输入框已有内容确认、Web 模式降级、insertAndSend 选项

---

## 一、目标

将现有 Web SPA 改造为 Chrome 扩展（Manifest V3），使得：
1. API 请求可**直连** Anthropic/OpenAI 而无需中间代理（通过 `host_permissions` 绕过 CORS）
2. 用户数据仍存储在**浏览器本地**（IndexedDB + localStorage），不经过任何外部服务器
3. 保留现有全部功能，并利用扩展特权增加能力（快捷键、右键菜单等）

---

## 二、核心架构变更

### 2.1 当前 vs 目标

| 维度 | 当前（Web SPA） | 目标（Chrome 扩展） |
|------|----------------|---------------------|
| 入口 | `index.html` + `main.tsx` | `popup.html`（弹窗）+ `side_panel.html`（侧边栏）+ `options.html`（设置页） |
| 路由 | BrowserRouter（`/`、`/prompts/:id`） | HashRouter（扩展不支持 pathname 路由） |
| API 请求 | 通过 `/api/proxy` 转发，Cloudflare Functions 代理 | 直接 `fetch()`，`manifest.json` 声明 `host_permissions` |
| 存储 | localStorage + IndexedDB | 同，可选迁移至 `chrome.storage.sync`（跨设备同步） |
| 构建 | `vite build` → `dist/` | `vite build` → `dist-ext/`，额外产出 `manifest.json` + `service_worker.js` |
| CSP | Vite 默认 | 扩展 CSP v3 严格限制，需适配 |

### 2.2 入口设计

扩展有三种展示形态，各用一个 HTML 入口：

| 入口 | 文件 | 尺寸 | 用途 |
|------|------|------|------|
| **Popup** | `popup.html` | 弹出小窗（默认 400×600） | 快速查看、搜索提示词 |
| **Side Panel** | `side_panel.html` | 侧边栏（可调宽 300–800px） | 主要编辑界面（原全页功能） |
| **Options** | `options.html` | 独立标签页 | AI 设置页 |

推荐以 **Side Panel** 为主入口（Chrome 114+ 支持），通过 `sidePanel` API 打开，空间够大，和原 Web 版体验最接近。Popup 作为快捷入口，点击后打开 Side Panel。

### 2.3 路由改造

```diff
- <BrowserRouter>
+ <HashRouter>
    <Routes>
-     <Route path="/" element={<HomePage />} />
+     <Route path="/" element={<HomePage />} />
-     <Route path="/prompts/:id" element={<PromptDetailPage />} />
+     <Route path="/prompts/:id" element={<PromptDetailPage />} />
    </Routes>
- </BrowserRouter>
+ </HashRouter>
```

`BrowserRouter` 依赖服务端对 `/prompts/xxx` 返回 index.html；扩展没有服务端，必须用 `HashRouter`（`#/prompts/xxx`）。

---

## 三、Chrome Extension Manifest（MV3）

新建 `public/manifest.chrome.json`，构建时复制为 `dist-ext/manifest.json`：

```json
{
  "manifest_version": 3,
  "name": "AI Prompt Manager",
  "version": "1.0.0",
  "description": "纯本地 Prompt 全生命周期管理工具",
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  "permissions": [
    "storage",
    "sidePanel"
  ],
  "host_permissions": [
    "https://api.anthropic.com/*",
    "https://api.openai.com/*",
    "https://generativelanguage.googleapis.com/*"
  ],
  "side_panel": {
    "default_path": "side_panel.html"
  },
  "action": {
    "default_title": "AI Prompt Manager",
    "default_icon": "icons/icon48.png"
  },
  "options_page": "options.html",
  "content_security_policy": {
    "extension_pages": "script-src 'self'; object-src 'self'"
  }
}
```

关键点：
- `host_permissions` 声明对 AI API 的跨域权限，**浏览器不会拦截 CORS**
- `permissions: ["sidePanel"]` 启用侧边栏 API
- `content_security_policy` 不允许 `unsafe-eval`（`@anthropic-ai/sdk` 和 `openai` SDK 需要注意）
- 不需要 `"tabs"`、`"activeTab"` 等权限（不操作网页）

---

## 四、核心代码改造

### 4.1 移除代理，直连 API

**文件**: `src/services/ai/fetchWithProxy.ts`

```typescript
// 改造后：扩展环境直接 fetch，不做代理
export function createProxyFetch(): typeof fetch {
  return (url, init) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // 如果配置了自定义 baseUrl，且 URL 仍是外部地址，直接 fetch
    // （扩展的 host_permissions 已覆盖 CORS）
    return fetch(urlStr, init);
  };
}
```

或者直接在 `anthropic.ts` / `openai.ts` 中去掉 `fetch: createProxyFetch()`，用 SDK 默认的 fetch。但保留 `createProxyFetch` 带来的好处是可以留一个环境判断——扩展下直连，Web 下走代理。

**⚠️ 评审纠正**：`dangerouslyAllowBrowser: true` **必须保留**。Side Panel、Popup、Options 页面仍然是完整的浏览器环境（有 `window`、`document`、`globalThis.fetch`），SDK 通过这些对象检测浏览器环境。移除会导致 SDK 初始化时抛出错误：

```
It looks like you're running in a browser-like environment.
This is disabled by default, as it risks exposing your API key.
```

**正确做法 —— 文件**: `src/services/ai/anthropic.ts` 和 `src/services/ai/openai.ts`

```typescript
this.client = new Anthropic({
  apiKey,
  baseURL: baseUrl || undefined,
  dangerouslyAllowBrowser: true,  // ✅ 保留，扩展页面仍是浏览器环境
  // fetch 由 shouldUseProxy() 条件注入
  ...(shouldUseProxy() ? { fetch: createProxyFetch() } : {}),
});
```

同理修改 `OpenAIProvider` 构造函数。

### 4.2 路由改为 HashRouter

**文件**: `src/App.tsx`

```diff
- import { BrowserRouter, Routes, Route } from 'react-router-dom';
+ import { HashRouter, Routes, Route } from 'react-router-dom';

-       <BrowserRouter>
+       <HashRouter>
          ...
-       </BrowserRouter>
+       </HashRouter>
```

### 4.3 入口 HTML 文件

三个入口 HTML 都需要包含**主题初始化脚本**（从 `index.html` 第 11-18 行复制），避免页面加载时的白色闪烁。MV3 CSP 允许同源内联 `<script>`，此脚本安全。

**新建 `popup.html`**（根目录）：
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prompt Manager</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/popup.tsx"></script>
</body>
</html>
```

**新建 `side_panel.html`**（根目录）：
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prompt Manager</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/sidepanel.tsx"></script>
</body>
</html>
```

**新建 `options.html`**（根目录）：
```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Prompt Manager - 设置</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/options.tsx"></script>
</body>
</html>
```

**保留 `index.html`** 用于开发调试（`pnpm dev` 时仍可 Web 模式跑）。

### 4.4 新建入口 TSX 文件

**新建 `src/sidepanel.tsx`**：
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**新建 `src/popup.tsx`**：
```typescript
// Popup 只做一件事：点击打开 Side Panel
// chrome.sidePanel.open() 需要用户手势，popup 页面提供这个入口
import { useEffect } from 'react';

export default function Popup() {
  useEffect(() => {
    // 自动打开侧边栏，然后关闭 popup
    if (chrome.sidePanel) {
      chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      window.close();
    }
  }, []);

  return <div style={{ padding: 16, textAlign: 'center' }}>正在打开...</div>;
}
```

**新建 `src/options.tsx`**：
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import AISettings from '@/components/settings/AISettings';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AISettings forceOpen />
  </React.StrictMode>
);
```

### 4.5 Vite 构建配置

**文件**: `vite.config.ts`

需要调整为多入口构建：

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';

// ⚠️ 需安装依赖：pnpm add -D vite-plugin-static-copy

function apiProxyPlugin() {
  // ... 保持不变（见当前 vite.config.ts），仅 Web 模式使用
}

export default defineConfig(({ mode }) => {
  const isExtension = mode === 'extension';

  return {
    plugins: [
      react(),
      // 扩展模式：复制 manifest 和图标
      ...(isExtension ? [viteStaticCopy({
        targets: [
          { src: 'public/manifest.chrome.json', dest: '.', rename: 'manifest.json' },
          { src: 'public/icons/*', dest: 'icons' },
        ],
      })] : []),
      // ⚠️ 扩展模式下不需要 API 代理插件，直连 API
      ...(!isExtension ? [apiProxyPlugin()] : []),
    ],
    resolve: {
      alias: { '@': path.resolve(__dirname, './src') },
      dedupe: ['@codemirror/state', '@codemirror/view'],  // 保留现有配置
    },
    define: {
      global: 'globalThis',
      ...(isExtension ? { 'import.meta.env.VITE_IS_EXTENSION': JSON.stringify('true') } : {}),
    },
    // ⚠️ 扩展模式不使用 publicDir，避免 PWA 文件（sw.js、manifest.json 等）混入
    publicDir: isExtension ? false : 'public',
    build: {
      outDir: isExtension ? 'dist-ext' : 'dist',
      rollupOptions: {
        // 扩展模式：多入口构建
        ...(isExtension ? {
          input: {
            popup: path.resolve(__dirname, 'popup.html'),
            sidepanel: path.resolve(__dirname, 'side_panel.html'),
            options: path.resolve(__dirname, 'options.html'),
          },
        } : {}),
        external: [/^node:/],
      },
    },
    optimizeDeps: {
      exclude: ['@anthropic-ai/sdk'],
      include: ['standardwebhooks'],
      esbuildOptions: {
        define: { global: 'globalThis' },
      },
    },
  };
});
```

`package.json` 新增脚本：

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "build:ext": "tsc -b && vite build --mode extension",
    "preview": "vite preview"
  }
}
```

### 4.6 Service Worker 适配

当前 `public/sw.js` 是 PWA service worker。扩展的 **Service Worker 不是必须的**（扩展本身持久化），但如果需要后台功能可以添加。

改造方案：保留文件但不默认注册。`main.tsx` 中判断环境：

```typescript
// 只在 Web 模式注册 Service Worker
if ('serviceWorker' in navigator && import.meta.env.PROD && !import.meta.env.VITE_IS_EXTENSION) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
```

### 4.7 图标资源

当前图标是 `public/AI.svg`，扩展需要不同尺寸的 PNG：

需要生成以下尺寸放到 `public/icons/`：
- `icon16.png` (16×16)
- `icon48.png` (48×48)
- `icon128.png` (128×128)

可以后续用脚本从 SVG 批量生成。

### 4.8 环境判断工具

**新建 `src/utils/env.ts`**：

```typescript
// 判断是否在 Chrome 扩展环境运行
export const isExtension = (): boolean => {
  return typeof chrome !== 'undefined' && !!chrome?.runtime?.id;
};

// 判断是否在生产模式
export const isProd = import.meta.env.PROD;

// 是否需要使用代理 fetch（扩展不需要，Web 需要）
export function shouldUseProxy(): boolean {
  return !isExtension();
}
```

各 AI Provider 的构造函数中根据 `shouldUseProxy()` 决定是否注入 `fetch: createProxyFetch()`。

### 4.9 修复 AISettings "测试连接" 逻辑

**⚠️ 评审发现遗漏**：`src/components/settings/AISettings.tsx` 中的"测试连接"功能（约第 118-147 行）存在 `try直连 → catch fallback到 /api/proxy` 的逻辑。在扩展环境中，直连即可成功（有 `host_permissions`），而 `/api/proxy` 不存在，fallback 反而会失败。

**改造**：根据 `isExtension()` 环境判断：
- **扩展环境**：只做直连，不 fallback
- **Web 环境**：保持现有逻辑

```typescript
import { isExtension } from '@/utils/env';

// 测试连接时：
if (isExtension()) {
  // 扩展环境直连
  const result = await fetch(apiUrl, { headers, body });
  // ...
} else {
  // Web 环境先直连，失败后走代理
  // （保持原有逻辑）
}
```

---

## 五、CSP（内容安全策略）适配

### 5.1 问题

MV3 的 `content_security_policy` 不允许：
- `unsafe-eval` — 很多 NPM 包可能用到 `eval()` / `new Function()`
- `unsafe-inline` — 不允许内联 `<script>` 或 `<style>`
- 不允许加载外部 CDN 资源

### 5.2 排查结果

| 风险点 | 结论 |
|--------|------|
| `@anthropic-ai/sdk@0.101.0` 是否用 `eval` | ✅ **已验证无** — SDK 及依赖链均不含 `eval()` 或 `new Function()` |
| `openai@6.42.0` 是否用 `eval` | ✅ **已验证无** |
| `dangerouslyAllowBrowser` | ✅ **需保留**（见 4.1 节纠正） |
| `connect-src` 对 SSE streaming | ✅ MV3 未指定 `connect-src` 时默认为 `*`，不阻止 fetch/SSE |
| `script-src 'self'` 对内联 `<script>` | ✅ 扩展 CSP 的 `'self'` 允许同源内联脚本，主题初始化脚本安全 |

### 5.3 如果遇到 CSP 错误

如果某个依赖确实用到 `eval`，需要：
1. 检查是否有替代包
2. 或改用 `sandbox` 页面（MV3 支持，但实现复杂）
3. 或向依赖提交 PR 去掉 eval

---

## 六、存储适配

### 6.1 现状

| 存储 | API | 用途 |
|------|-----|------|
| IndexedDB (Dexie) | `src/db/index.ts` | 场景、提示词、版本 |
| localStorage | `src/store/settingsStore.ts` | AI 设置、API Key |

### 6.2 扩展改造（可选）

可以保持现状——扩展里的 IndexedDB 和 localStorage 照样能用。如果需要**跨设备同步**，可迁移到 `chrome.storage.sync`：

| chrome.storage 方式 | 特点 |
|---------------------|------|
| `chrome.storage.local` | 类似 localStorage，但异步、无大小限制 |
| `chrome.storage.sync` | 跨设备同步，上限 100KB，用于配置（API Key 等） |

建议：
- **阶段一**：保持 localStorage + IndexedDB 不动，最小改动
- **阶段二**（可选优化）：AI 设置迁移到 `chrome.storage.sync`，实现跨设备同步配置

---

## 七、UI 适配

### 7.1 尺寸适配

Side Panel 默认 388px 宽（用户可拖拽到 300–800px），远小于原 Web 全页宽度。

**需要改造的点**：
1. `PromptDetailPage` 的侧面板（版本历史 / 模型对比 / 质量分析）在小宽度下改为**叠加层**而非并排显示
2. `Header` 的搜索栏和按钮需响应式收缩
3. `MultiModelTest` 多模型对比列在小宽度下改为**堆叠布局**

### 7.2 响应式断点

```css
/* 当前已有部分响应式（md: 前缀 = 768px） */
/* 扩展侧边栏有效宽度 300–800px，建议新增断点： */
/* --ext-min:  300px */
/* --ext-mid:  500px（从并排切换到堆叠） */
/* --ext-wide: 700px */
```

可以在 Tailwind 配置中添加自定义断点。

---

## 八、一键插入 AI 平台（核心差异化功能）

竞品普遍只有"复制到剪贴板"，用户还得自己切标签页粘贴。一键插入自动填到 ChatGPT/Claude 输入框，体验天差地别。

### 8.1 用户流程

```
用户在 Side Panel 写好/找到 prompt
        │
        ▼
点击 "插入到 ChatGPT"（或按 Ctrl+Enter）
        │
        ├─ prompt 里有 {{变量}}？
        │     │
        │     ├─ 有 → 弹出变量填写面板 → 填写后确定
        │     │
        │     ▼
        │
        ▼
自动定位到已打开的 ChatGPT 标签页（没有则打开新标签）
        │
        ▼
Content Script 找到输入框，填入解析后的 prompt 文本
        │
        ▼
光标定位到输入框末尾，用户直接按 Enter 发送
```

### 8.2 技术架构

```
┌─────────────────────┐     chrome.runtime.sendMessage     ┌──────────────────┐
│   Side Panel        │ ──────────────────────────────────> │  Content Script  │
│   (Prompt Detail)   │ <────────────────────────────────── │  (注入到 AI 平台) │
│                     │       返回结果/确认                  │                  │
└─────────────────────┘                                     └──────────────────┘
                                                                   │
                                                          findInputField()
                                                          insertText()
                                                          focusField()
```

- **Side Panel** 负责：展示"插入"按钮、处理变量填写弹窗、调用 message API
- **Content Script** 负责：定位输入框、填入文本、触发 input 事件（让 React 框架感知变化）

### 8.3 支持的平台及 DOM 选择器

不同 AI 平台的输入框 DOM 结构不同，需要在 Content Script 中逐一适配：

### 国外平台

| 平台 | 域名 | 输入框定位策略 |
|------|------|---------------|
| **ChatGPT** | `chatgpt.com` | `#prompt-textarea` / `[data-testid="prompt-textarea"]` / `form [contenteditable="true"]` |
| **Claude** | `claude.ai` | `div[contenteditable="true"].ProseMirror` / `[aria-label="Message Claude"][contenteditable]` |
| **Gemini** | `gemini.google.com` | `rich-textarea [contenteditable="true"]` / `div[role="textbox"][contenteditable]` |

### 国内平台

| 平台 | 域名 | 输入框定位策略 |
|------|------|---------------|
| **DeepSeek** | `chat.deepseek.com` | `#chat-input` / `textarea[placeholder*="Send"]` / `textarea` |
| **豆包 (Doubao)** | `www.doubao.com` | `textarea.semi-input-textarea` / `[data-testid="chat_input_input"]`（Semi Design UI） |
| **Kimi** | `kimi.moonshot.cn` | `div[contenteditable="true"]`（聊天区域底部） |
| **通义千问 (Qwen)** | `tongyi.aliyun.com` | `div[contenteditable="true"]`（富文本编辑器） |
| **文心一言** | `yiyan.baidu.com` | `div[contenteditable="true"]` / `textarea` |
| **元宝 (Yuanbao)** | `yuanbao.tencent.com` | `div[contenteditable="true"]` / `textarea` |
| **智谱清言 (ChatGLM)** | `chatglm.cn` | `div[contenteditable="true"]` / `textarea` |

> **注意**：国内平台 DOM 结构迭代频繁，部分使用 Shadow DOM 封装（如豆包 Semi Design 组件），上线后需持续维护选择器。各平台发送按钮选择器也需适配（常见：`button[type=submit]`、`button[aria-label*="发送"]`、`.send-btn-wrapper button`）。

每个平台输入框的行为不同：
- **contenteditable div**：需用 `innerText` 设值 + `input` 事件通知 React
- **原生 textarea**：需用 `value` 设值 + `input` + `change` 事件

```typescript
// content-scripts/dom-finders.ts

interface InputTarget {
  element: HTMLElement;
  type: 'contenteditable' | 'textarea' | 'input';
}

// ── 国外平台 ──

function findChatGPTInput(): InputTarget | null {
  return resolveSelectors([
    '#prompt-textarea',
    '[data-testid="prompt-textarea"]',
    'form [contenteditable="true"]',
  ], 'contenteditable');
}

function findClaudeInput(): InputTarget | null {
  return resolveSelectors([
    'div.ProseMirror[contenteditable="true"]',
    '[aria-label="Message Claude"][contenteditable]',
    '[contenteditable="true"]',
  ], 'contenteditable');
}

function findGeminiInput(): InputTarget | null {
  return resolveSelectors([
    'rich-textarea [contenteditable="true"]',
    'div[role="textbox"][contenteditable]',
    '[contenteditable="true"]',
  ], 'contenteditable');
}

// ── 国内平台 ──

function findDeepSeekInput(): InputTarget | null {
  return resolveSelectors([
    '#chat-input',
    'textarea[placeholder*="Send a message"]',
    'textarea',
  ], 'textarea');
}

function findDoubaoInput(): InputTarget | null {
  // 豆包使用 Semi Design UI，输入框可能被 Shadow DOM 封装
  const el = document.querySelector('textarea.semi-input-textarea')
    || document.querySelector('[data-testid="chat_input_input"]')
    || document.querySelector('textarea');
  if (el) {
    return {
      element: el as HTMLElement,
      type: el.tagName === 'TEXTAREA' ? 'textarea' : 'contenteditable',
    };
  }
  // 尝试穿透 Shadow DOM
  const host = document.querySelector('[class*="chat"]');
  if (host?.shadowRoot) {
    const shadowEl = host.shadowRoot.querySelector('textarea');
    if (shadowEl) return { element: shadowEl as HTMLElement, type: 'textarea' };
  }
  return null;
}

function findKimiInput(): InputTarget | null {
  return resolveSelectors([
    'div[contenteditable="true"]',
    'textarea',
  ], 'contenteditable');
}

function findQwenInput(): InputTarget | null {
  return resolveSelectors([
    'div[contenteditable="true"]',
    'textarea',
  ], 'contenteditable');
}

function findYiyanInput(): InputTarget | null {
  return resolveSelectors([
    'div[contenteditable="true"]',
    'textarea',
  ], 'contenteditable');
}

function findYuanbaoInput(): InputTarget | null {
  return resolveSelectors([
    'div[contenteditable="true"]',
    'textarea',
  ], 'contenteditable');
}

function findChatGLMInput(): InputTarget | null {
  return resolveSelectors([
    'div[contenteditable="true"]',
    'textarea',
  ], 'contenteditable');
}

// ── 工具函数 ──

function resolveSelectors(
  selectors: string[],
  type: 'contenteditable' | 'textarea'
): InputTarget | null {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const tag = el.tagName.toUpperCase();
      return {
        element: el as HTMLElement,
        type: tag === 'TEXTAREA' || tag === 'INPUT' ? 'textarea' : type,
      };
    }
  }
  return null;
}

// ── 平台注册表 ──

const finders: Record<string, () => InputTarget | null> = {
  'chatgpt.com': findChatGPTInput,
  'claude.ai': findClaudeInput,
  'gemini.google.com': findGeminiInput,
  'chat.deepseek.com': findDeepSeekInput,
  'www.doubao.com': findDoubaoInput,
  'kimi.moonshot.cn': findKimiInput,
  'tongyi.aliyun.com': findQwenInput,
  'yiyan.baidu.com': findYiyanInput,
  'yuanbao.tencent.com': findYuanbaoInput,
  'chatglm.cn': findChatGLMInput,
};

export function detectPlatform(): string | null {
  const host = window.location.hostname;
  if (host.includes('chatgpt.com')) return 'ChatGPT';
  if (host.includes('claude.ai')) return 'Claude';
  if (host.includes('gemini')) return 'Gemini';
  if (host.includes('deepseek.com')) return 'DeepSeek';
  if (host.includes('doubao.com')) return '豆包';
  if (host.includes('kimi.moonshot.cn') || host.includes('kimi.com')) return 'Kimi';
  if (host.includes('tongyi.aliyun.com') || host.includes('qianwen.aliyun.com')) return '通义千问';
  if (host.includes('yiyan.baidu.com')) return '文心一言';
  if (host.includes('yuanbao.tencent.com')) return '元宝';
  if (host.includes('chatglm.cn')) return '智谱清言';
  return null;
}

// 主查找：先精确匹配，再启发式兜底
export function findInputField(): InputTarget | null {
  const host = window.location.hostname;
  for (const [domain, finder] of Object.entries(finders)) {
    if (host.includes(domain)) {
      const result = finder();
      if (result) return result;
    }
  }
  // 启发式兜底：页面最底部、面积最大的可见 contenteditable/textarea
  return heuristicFindInput();
}

// 启发式通用查找器
function heuristicFindInput(): InputTarget | null {
  const candidates = [
    ...Array.from(document.querySelectorAll('[contenteditable="true"]')),
    ...Array.from(document.querySelectorAll('textarea')),
  ];
  // 过滤不可见元素，按视口位置排序（越靠下越优先），取面积 > 阈值
  const visible = candidates
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 100 && rect.height > 30 && rect.bottom < window.innerHeight + 200;
    })
    .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);

  const best = visible[0] as HTMLElement | undefined;
  if (!best) return null;

  return {
    element: best,
    type: best.tagName === 'TEXTAREA' ? 'textarea' : 'contenteditable',
  };
}
```

### 8.4 文本插入逻辑

**⚠️ 评审纠正**：原设计的 `textContent + input` 事件方案对 ChatGPT（Slate/TipTap）和 Claude（ProseMirror）等富文本编辑器不可靠——这些框架维护内部文档模型，直接改 `textContent` 会绕过其事务系统。

**推荐分层策略**（按优先级尝试）：

1. **Clipboard API 模拟粘贴** — 最通用，ProseMirror / Slate / TipTap 都会处理 `paste` 事件
2. **框架专用 API** — ProseMirror `view.dispatch(tr.insertText())`
3. **兜底 textContent + 事件** — 简单 contenteditable 的备选

```typescript
// content-scripts/insert-text.ts

function insertViaClipboard(el: HTMLElement, text: string): boolean {
  try {
    el.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: dt, bubbles: true, cancelable: true,
    }));
    return true;
  } catch { return false; }
}

function insertViaProseMirror(el: HTMLElement, text: string): boolean {
  try {
    const view = (el as any).__proseMirrorView;
    if (view?.dispatch) {
      const tr = view.state.tr.insertText(text);
      view.dispatch(tr);
      view.focus();
      return true;
    }
    return false;
  } catch { return false; }
}

function insertIntoContentEditable(el: HTMLElement, text: string): boolean {
  // 策略 1: Clipboard API（最通用）
  if (insertViaClipboard(el, text)) return true;
  // 策略 2: ProseMirror 专用
  if (insertViaProseMirror(el, text)) return true;
  // 策略 3: 兜底
  el.focus();
  el.textContent = text;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  const sel = window.getSelection();
  if (sel) { sel.selectAllChildren(el); sel.collapseToEnd(); }
  return true;
}

function insertIntoTextarea(el: HTMLTextAreaElement, text: string): void {
  el.focus();
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype, 'value'
  )?.set;
  if (nativeSetter) { nativeSetter.call(el, text); } else { el.value = text; }
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

export function insertText(target: InputTarget, text: string): boolean {
  // 基本无害处理
  const sanitized = text.replace(/\x00/g, '');
  try {
    if (target.type === 'contenteditable') {
      return insertIntoContentEditable(target.element as HTMLElement, sanitized);
    }
    insertIntoTextarea(target.element as HTMLTextAreaElement, sanitized);
    return true;
  } catch {
    return false;
  }
}
```

### 8.5 变量处理流程

**⚠️ 评审纠正**：原设计自定义了 `|` 管道语法，与项目现有的变量系统（`:` 分隔，见 `src/utils/variables.ts`）不兼容。**必须复用已有的 `extractVariables`、`renderTemplate` 和 `VariableForm` 组件。**

现有变量语法：

```
{{name}}              → 纯文本输入
{{name:text}}         → 文本输入
{{name:textarea}}     → 多行文本
{{name:number:0,100}} → 数字范围
{{name:boolean}}      → 复选框
{{name:select:A,B,C}} → 下拉选择
```

**InsertDialog 直接复用已有组件**：

```typescript
// src/components/insert/InsertDialog.tsx
import { useState, useMemo } from 'react';
import { extractVariables, renderTemplate } from '@/hooks/useVariables';
import VariableForm from '@/components/ai/VariableForm';
import type { VariableInfo } from '@/hooks/useVariables';
import { insertPrompt } from '@/services/insertService';

interface InsertDialogProps {
  content: string;
  open: boolean;
  onClose: () => void;
}

export default function InsertDialog({ content, open, onClose }: InsertDialogProps) {
  const [platform, setPlatform] = useState('chatgpt');
  const [values, setValues] = useState<Record<string, string>>({});

  const defs = useMemo(() => extractVariables(content), [content]);
  const variables: VariableInfo[] = useMemo(
    () => defs.map((d) => ({ ...d, value: values[d.name] ?? '' })),
    [defs, values]
  );
  const resolved = useMemo(() => renderTemplate(content, variables), [content, variables]);

  const handleInsert = async () => {
    const result = await insertPrompt(platform, resolved);
    if (result.success) {
      onClose();
      // 通知 toast
    }
  };

  const hasVars = defs.length > 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogTitle>插入到 AI 平台</DialogTitle>

        {/* 平台选择 */}
        <div className="flex gap-2">
          {['chatgpt', 'claude', 'gemini', 'perplexity', 'grok'].map((p) => (
            <PlatformChip key={p} platform={p} active={platform === p} onClick={setPlatform} />
          ))}
        </div>

        {/* 变量填写（复用已有 VariableForm） */}
        {hasVars && (
          <VariableForm
            template={content}
            onCopy={() => {}}  // 插入模式不需要复制
            onTest={() => {}}  // 插入模式不需要测试
          />
        )}

        {/* 预览 */}
        {!hasVars && (
          <div className="max-h-32 overflow-y-auto text-sm text-muted-foreground border rounded p-2">
            {resolved}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button onClick={handleInsert}>
            插入到 {platformLabel(platform)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 8.6 标签页定位与重试策略

**⚠️ 评审纠正**：原设计的 `setTimeout 2s` 硬等待不可靠——ChatGPT 偶需 5+ 秒渲染完毕。改为带指数退避的重试循环。

**多标签页处理**：如果用户开了多个 ChatGPT 窗口，应弹窗让用户选择，而非强制选第一个。

```typescript
// src/services/insertService.ts

interface InsertResult { success: boolean; message: string; }

const DOMAIN_MAP: Record<string, string> = {
  chatgpt: 'chatgpt.com',
  claude: 'claude.ai',
  gemini: 'gemini.google.com',
  perplexity: 'perplexity.ai',
  grok: 'grok.com',
};

// 带退避的重试发送消息（Content Script 可能尚未完全初始化）
async function sendMessageWithRetry(
  tabId: number, text: string, maxRetries = 10, baseDelay = 300
): Promise<InsertResult> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, {
        type: 'INSERT_PROMPT', text,
      });
      if (result?.success) return result;
      if (result?.error === 'INPUT_NOT_FOUND') {
        // Content Script 运行了但找不到输入框——不再重试
        return { success: false, message: '无法定位输入框，请确认页面已完全加载' };
      }
    } catch {
      // Content Script 尚未就绪，退避重试
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, i)));
      }
    }
  }
  return { success: false, message: '无法连接到页面，请刷新后重试' };
}

// 选择目标标签页
async function selectTargetTab(
  domain: string, platform: string
): Promise<{ tabId: number; isNew: boolean } | null> {
  const tabs = await chrome.tabs.query({ url: `*://${domain}/*` });

  if (tabs.length === 1 && tabs[0]?.id != null) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    return { tabId: tabs[0].id, isNew: false };
  }

  if (tabs.length > 1) {
    // ⚠️ 多个匹配标签页 → 返回选项让 UI 展示选择列表
    // 实际实现中，insertService 抛出 TABS_AMBIGUOUS 状态，
    // InsertDialog 渲染标签页选择 UI
    return null; // 由调用方处理
  }

  // 无匹配标签页 → 新开
  const newTab = await chrome.tabs.create({
    url: `https://${domain}`,
    active: true,
  });
  if (!newTab.id) return null;
  // 需要等待页面加载 + Content Script 注入完毕
  await new Promise((r) => setTimeout(r, 1500));
  return { tabId: newTab.id, isNew: true };
}

// 主入口
export async function insertPrompt(
  platform: string, text: string, preferredTabId?: number
): Promise<InsertResult> {
  const domain = DOMAIN_MAP[platform];
  if (!domain) return { success: false, message: `不支持的平台: ${platform}` };

  let tabId = preferredTabId;
  if (!tabId) {
    const target = await selectTargetTab(domain, platform);
    if (!target) {
      // 多标签页情况，返回特殊状态由 UI 处理
      return { success: false, message: 'MULTIPLE_TABS', platform };
    }
    tabId = target.tabId;
  }

  return sendMessageWithRetry(tabId, text);
}

// 获取所有匹配标签页（供多标签选择 UI 使用）
export async function getPlatformTabs(platform: string) {
  const domain = DOMAIN_MAP[platform];
  if (!domain) return [];
  return chrome.tabs.query({ url: `*://${domain}/*` });
}
```

### 8.6.1 Content Script Ready 协议

Content Script 初始化完毕后应主动告知：

```typescript
// content-scripts/insert.ts
// 页面加载完成后，向扩展发送就绪信号
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY', platform: detectPlatform() });

// 监听插入指令
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'INSERT_PROMPT') {
    const target = findInputField();
    if (!target) {
      sendResponse({ success: false, error: 'INPUT_NOT_FOUND' });
      return;
    }
    const ok = insertText(target, msg.text);
    sendResponse({ success: ok });
  }
});
```

insertService 可以维护一个 `readyTabs` Set，在发送消息前先检查目标 tab 是否已就绪。

### 8.7 所需权限变更

**⚠️ 评审提醒**：`tabs` 权限会让用户在安装时看到 **"Read your browsing history"** 警告，可能吓跑部分用户。这是 `chrome.tabs.query` 的硬依赖（`activeTab` 不足以查询非活跃标签页），功能价值大于风险，但需在商店描述中说明原因。

```json
{
  "permissions": ["storage", "sidePanel", "tabs"],
  "host_permissions": [
    "https://api.anthropic.com/*",
    "https://api.openai.com/*"
  ],
  "optional_host_permissions": [
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://perplexity.ai/*",
    "https://grok.com/*",
    "https://x.com/i/grok*"
  ],
  "content_scripts": [
    {
      "matches": [
        "https://chatgpt.com/*",
        "https://claude.ai/*",
        "https://gemini.google.com/*",
        "https://perplexity.ai/*",
        "https://grok.com/*",
        "https://x.com/i/grok*"
      ],
      "js": ["content-scripts/insert.js"],
      "run_at": "document_idle"
    }
  ]
}
```

**关键变更**：
- `host_permissions` 对 AI 平台域名改为 **`optional_host_permissions`** — 避免初次安装时权限列表过长，首次使用时通过 `chrome.permissions.request()` 按需申请
- `tabs` 权限需在商店描述中注明用途（"用于定位已打开的 AI 平台标签页以实现一键插入"）
- `content_scripts.matches` 保持不变（声明式注入仍需在 manifest 中声明）

### 8.7.1 边角情况与降级策略

**评审补充**：

| 边角情况 | 处理方案 |
|----------|---------|
| **多标签页** | InsertDialog 展示标签页列表（标题 + favicon），用户选择目标 |
| **标签页加载中** | 8.6 节的重试循环 + CONTENT_SCRIPT_READY 协议 |
| **用户未登录** | 非阻塞——文本能填入，但可能后续需登录。可选：检测 `login`/`signin` 按钮并提示 |
| **地区域名**（`gemini.google.co.jp`） | Content Script `matches` 使用 `*://*.google.*/*` 通配，平台检测函数用 `hostname.includes('gemini')` |
| **输入框已有内容** | 插入前检查输入框是否非空，若非空则弹出确认："输入框已有内容，是否覆盖？" |
| **Web 模式降级** | `isExtension()` 为 false 时，插入按钮不显示；或点击后直接 fallback 到"复制到剪贴板 + toast" |
| **插入后发送** | 可选 `insertAndSend` 配置：插入后自动触发 Enter 键 |

### 8.7.2 区域通配 Content Script

```json
"content_scripts": [
  {
    "matches": [
      "https://chatgpt.com/*",
      "https://claude.ai/*",
      "https://*.google.*/*",
      "https://chat.deepseek.com/*",
      "https://www.doubao.com/*",
      "https://kimi.moonshot.cn/*",
      "https://www.kimi.com/*",
      "https://tongyi.aliyun.com/*",
      "https://qianwen.aliyun.com/*",
      "https://yiyan.baidu.com/*",
      "https://yuanbao.tencent.com/*",
      "https://chatglm.cn/*"
    ],
    "js": ["content-scripts/insert.js"],
    "run_at": "document_idle"
  }
]
```

平台检测函数见 8.3 节 `detectPlatform()`，支持返回中文平台名。

### 8.8 文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/components/insert/InsertDialog.tsx` | **新建** | 变量填写 + 平台选择弹窗 |
| `src/components/insert/PlatformButton.tsx` | **新建** | "插入到 ChatGPT"等快捷按钮 |
| `content-scripts/insert.ts` | **新建** | Content Script：DOM 查找 + 文本插入 |
| `content-scripts/dom-finders.ts` | **新建** | 各平台 DOM 选择器适配 |
| `src/services/insertService.ts` | **新建** | 标签页管理 + message 发送封装 |
| `src/hooks/useInsertPrompt.ts` | **新建** | 插入功能的 hook 封装 |
| `src/pages/PromptDetailPage.tsx` | **修改** | 工具栏增加插入按钮 |
| `public/manifest.chrome.json` | **修改** | 增加 permissions 和 content_scripts |
| `vite.config.ts` | **修改** | Content Script 独立构建入口 |

### 8.9 Vite 构建适配

**⚠️ 评审纠正**：MV3 Content Script **不支持 `type="module"`**（Chrome 的 content_scripts 声明中没有此属性）。Vite 默认输出 ES module（含 `import`/`export`），直接用作 Content Script 会报错。需要构建为 **IIFE 格式**。

**推荐方案**：使用 `vite-plugin-web-extension`，它自动处理 Content Script 的 IIFE 输出、manifest 生成和开发重载。

如果坚持手动方案，需要为 Content Script 单独配置 Vite build：

```typescript
// vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => {
  const isExtension = mode === 'extension';

  return {
    build: {
      outDir: isExtension ? 'dist-ext' : 'dist',
      rollupOptions: {
        input: isExtension ? {
          popup: path.resolve(__dirname, 'popup.html'),
          sidepanel: path.resolve(__dirname, 'side_panel.html'),
          options: path.resolve(__dirname, 'options.html'),
          // Content Script 独立入口
          'content-scripts/insert': path.resolve(__dirname, 'content-scripts/insert.ts'),
        } : undefined,
        output: isExtension ? {
          // Content Script 输出为 IIFE，不含 hash
          entryFileNames: (chunk) => {
            if (chunk.name.startsWith('content-scripts/')) {
              return '[name].js';
            }
            return 'assets/[name]-[hash].js';
          },
          // ⚠️ 关键：Content Script 必须 IIFE 格式
          format: 'iife',  // 但这会影响所有入口！
          // 实际手动方案中，建议用 manualChunks 或独立 build 步骤
        } : undefined,
        external: [/^node:/],
      },
    },
  };
});
```

**⚠️ 手动方案的局限**：`format: 'iife'` 会影响所有入口（包括 popup/sidepanel/options 的 HTML 入口），导致它们也变成 IIFE 而非 ESM。因此**强烈建议使用 `vite-plugin-web-extension`** 来管理多格式输出，或为 Content Script 使用独立的 `vite.config.content.ts` 做构建。

替代手动方案——独立构建 Content Script：

```json
// package.json
{
  "scripts": {
    "build:ext": "tsc -b && vite build --mode extension && vite build --config vite.content.config.ts"
  }
}
```

### 8.10 实施步骤

| 步骤 | 内容 | 预估工时 |
|------|------|---------|
| 1 | 创建 `content-scripts/insert.ts` + `dom-finders.ts`（先支持 ChatGPT + Claude） | 2h |
| 2 | 创建 `src/services/insertService.ts`（标签页管理 + message） | 1h |
| 3 | 创建 `src/components/insert/InsertDialog.tsx`（变量填写弹窗） | 2h |
| 4 | 创建 `src/components/insert/PlatformButton.tsx`（快捷插入按钮组） | 1h |
| 5 | 修改 `PromptDetailPage.tsx` 工具栏集成插入按钮 | 0.5h |
| 6 | 修改 `manifest.chrome.json` + `vite.config.ts` | 1h |
| 7 | 追加 Gemini + Perplexity + Grok 适配 | 1.5h |
| 8 | 端到端测试各平台插入 + 变量填写 | 2h |
| **总计** | | **约 11h** |

---

## 九、新增扩展专属功能（可阶段二实现）

扩展环境相比 Web 可以加一些增强：

| 功能 | 实现方式 | 优先级 |
|------|---------|--------|
| 一键插入 AI 平台 | Content Script + chrome.tabs（详见第八节） | 🔴 高 |
| 全局快捷键打开侧边栏 | `manifest.json` 中 `commands` 字段 | 高 |
| 右键菜单保存选中文本为提示词 | `chrome.contextMenus` + Service Worker | 中 |
| 跨设备同步设置 | `chrome.storage.sync` | 中 |

---

## 十、构建与打包

### 10.1 构建命令

```bash
# Web 模式（保持兼容）
pnpm build

# 扩展模式
pnpm build:ext
```

### 10.2 产物结构

```
dist-ext/
├── manifest.json          # 扩展清单
├── popup.html             # Popup 入口
├── side_panel.html        # Side Panel 入口
├── options.html           # 设置页入口
├── assets/
│   ├── popup-[hash].js
│   ├── popup-[hash].css
│   ├── sidepanel-[hash].js
│   ├── sidepanel-[hash].css
│   ├── options-[hash].js
│   └── ...
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### 10.3 本地加载测试

1. 打开 Chrome → `chrome://extensions/`
2. 开启"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择 `dist-ext/` 目录
5. 点击工具栏图标，验证 Side Panel 打开

### 10.4 发布到 Chrome Web Store

1. 将 `dist-ext/` 打包为 `.zip`
2. 上传到 [Chrome Developer Dashboard](https://chrome.google.com/webstore/devconsole)
3. 审核通过后上架

---

## 十一、文件修改清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `public/manifest.chrome.json` | **新建 + 后续修改** | Chrome 扩展 manifest（含 content_scripts、tabs 权限） |
| `public/icons/icon*.png` | **新建** | 三种尺寸图标 |
| `popup.html` | **新建** | Popup 入口 |
| `side_panel.html` | **新建** | Side Panel 入口 |
| `options.html` | **新建** | 设置页入口 |
| `src/popup.tsx` | **新建** | Popup 逻辑（打开 Side Panel） |
| `src/sidepanel.tsx` | **新建** | Side Panel 入口（渲染 App） |
| `src/options.tsx` | **新建** | 设置页入口（渲染 AISettings） |
| `src/utils/env.ts` | **新建** | 环境判断工具 |
| `content-scripts/insert.ts` | **新建** | Content Script：接收消息 + 文本填入 |
| `content-scripts/dom-finders.ts` | **新建** | 各 AI 平台 DOM 选择器适配 |
| `src/services/insertService.ts` | **新建** | 标签页管理 + message 发送封装 |
| `src/hooks/useInsertPrompt.ts` | **新建** | 插入功能的 hook 封装 |
| `src/components/insert/InsertDialog.tsx` | **新建** | 变量填写 + 平台选择弹窗 |
| `src/components/insert/PlatformButton.tsx` | **新建** | "插入到 ChatGPT"等快捷按钮 |
| `src/App.tsx` | **修改** | BrowserRouter → HashRouter |
| `src/main.tsx` | **修改** | 扩展环境跳过 Service Worker 注册 |
| `src/services/ai/fetchWithProxy.ts` | **修改** | 扩展环境直连，Web 环境保留代理 |
| `src/services/ai/anthropic.ts` | **修改** | 条件性使用代理 fetch |
| `src/services/ai/openai.ts` | **修改** | 同上 |
| `src/components/layout/Header.tsx` | **修改** | 响应式适配窄宽度 |
| `src/pages/PromptDetailPage.tsx` | **修改** | 侧面板窄宽度叠加层 + 工具栏增加插入按钮 |
| `src/components/settings/AISettings.tsx` | **修改** | 测试连接逻辑：扩展环境去代理 fallback |
| `vite.config.ts` | **修改** | 多入口构建（含 Content Script）+ extension mode + publicDir 处理 |
| `package.json` | **修改** | 新增 `build:ext` 脚本、`devDependencies` 加 `vite-plugin-static-copy` + `@types/chrome` |
| `tailwind.config.js` | **可能修改** | 新增断点 |
| `tsconfig.json` | **可能修改** | `compilerOptions.types` 添加 `"chrome"` |

---

## 十二、风险与注意事项

1. **CSP eval 兼容** — `@anthropic-ai/sdk` 和 `openai` SDK 的某些版本可能内部使用 `eval`。构建后应先在 `chrome://extensions` 加载测试，观察是否有 CSP 错误。
2. **React DevTools** — 扩展环境下 React DevTools 可能检测不到，不影响功能。
3. **IndexedDB 隔离** — Chrome 扩展的 IndexedDB 和普通网页是**完全隔离**的。如果用户之前通过网页版使用，数据无法自动迁移。需要提供导入导出功能做迁移。
4. **OAuth 型 API** — 如果未来接入 Google AI（Gemini API 需 OAuth），扩展内需要额外处理 `chrome.identity` API。
5. **Edge 兼容** — Edge 兼容 Chrome 扩展，manifest 基本一致，后续可以同时上架 Edge Add-ons 商店。
6. **DOM 选择器脆弱性** — 一键插入功能依赖 AI 平台的 DOM 结构。应对方案（已补充进 8.3 和 8.4）：
   - 每个平台 3+ 备选选择器（attribute、role、placeholder、位置）
   - 启发式通用查找器：页面上最靠下的、可见的、面积 > 100×30px 的 contenteditable/textarea
   - 查找失败 → 自动复制到剪贴板 + toast 通知
   - 收集失败反馈（平台 + URL + DOM 快照）便于维护者更新
   - 可选：定期拉取远程配置（GitHub raw JSON）更新选择器映射，无需发版

---

## 十三、实施步骤（评审修正后顺序）

实施顺序已根据依赖关系重新排列——先做 Web 模式下可验证的改动（HashRouter、env.ts、Provider 改造），再做扩展专属配置。

| 阶段 | 步骤 | 预估工时 | 说明 |
|------|------|---------|------|
| **准备** | 0. `pnpm add -D vite-plugin-static-copy @types/chrome` | 0.1h | 安装新依赖 |
| **准备** | 1. 创建 `public/icons/` 三尺寸 PNG | 0.5h | SVG→PNG 可用 sharp 或在线工具 |
| **核心** | 2. 修改路由为 HashRouter | 0.5h | 可立即在 Web 模式验证 |
| **核心** | 3. 创建 `src/utils/env.ts` | 0.5h | 环境判断工具，Provider 需先有它 |
| **核心** | 4. 修改 AI Provider（条件代理）+ AISettings 测试连接 | 1.5h | 保留 `dangerouslyAllowBrowser: true` |
| **构建** | 5. 修改 `vite.config.ts` | 1h | 多入口、publicDir 处理、环境变量 |
| **构建** | 6. 创建 `manifest.chrome.json` | 0.5h | 扩展清单 |
| **构建** | 7. 新建 3 个 HTML 入口文件（含主题初始化脚本） | 0.5h | 依赖 vite 配置确认 |
| **构建** | 8. 新建 3 个 TSX 入口文件 | 1h | 依赖 HTML 入口 |
| **适配** | 9. UI 响应式适配 | 4-6h | 评审建议调高（300-500px 窄宽度重组） |
| **验证** | 10. 基础扩展加载测试、CSP 排错 | 2h | `chrome://extensions` 开发者模式 |
| **增量** | 11. 一键插入功能：Content Script + DOM 适配 | 3h | ChatGPT + Claude 先行，其余逐步追加 |
| **增量** | 12. 一键插入功能：InsertDialog + insertService | 3h | 变量弹窗 + 标签页定位 |
| **增量** | 13. 一键插入功能：PromptDetailPage 集成 + 端到端测试 | 5h | 按钮集成 + 多平台测试 |
| **验证** | 14. 全功能回归测试 | 2h | 含插入功能端到端 |
| **总计** | | **约 24-27h** | 含一键插入功能 |
