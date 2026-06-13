# P2-3：一键插入 AI 平台

> 来源: Chrome 扩展改造规划 §8 | 状态: 阶段一开发中 | 日期: 2026-06-11

> **2026-06-11 重评估修正**：Side Panel → 独立窗口（当前扩展实际架构）；DOMAIN_MAP 对齐 10 平台；移除 sidePanel 权限

一键插入自动填到 ChatGPT/Claude/DeepSeek 等 10 个主流 AI 平台输入框，支持变量解析和平台标签页定位。仅扩展模式可用，Web 模式降级为复制到剪贴板。

## 1. 用户流程

```
用户在独立窗口写好/找到 prompt
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

## 2. 技术架构

```
┌──────────────────────┐     chrome.tabs.sendMessage      ┌──────────────────┐
│  独立窗口 (Prompt     │ ───────────────────────────────> │  Content Script  │
│  Detail / PromptList) │ <─────────────────────────────── │  (注入到 AI 平台) │
│                       │       返回结果/确认               │                  │
└──────────────────────┘                                   └──────────────────┘
                                                                   │
                                                          findInputField()
                                                          insertText()
                                                          focusField()
```

- **独立窗口** 负责：展示"插入"按钮、处理变量填写弹窗、调用 `chrome.tabs.sendMessage`
- **Content Script** 负责：定位输入框、填入文本、触发 input 事件（让 React 框架感知变化）
- **Web 模式降级**：`isExtension() === false` 时，按钮不显示插入功能；或点击后复制到剪贴板

## 3. 支持的平台及 DOM 选择器

不同 AI 平台的输入框 DOM 结构不同，需要在 Content Script 中逐一适配：

### 3.1 国外平台

| 平台 | 域名 | 输入框定位策略 |
|------|------|---------------|
| **ChatGPT** | `chatgpt.com` | `#prompt-textarea` / `[data-testid="prompt-textarea"]` / `form [contenteditable="true"]` |
| **Claude** | `claude.ai` | `div[contenteditable="true"].ProseMirror` / `[aria-label="Message Claude"][contenteditable]` |
| **Gemini** | `gemini.google.com` | `rich-textarea [contenteditable="true"]` / `div[role="textbox"][contenteditable]` |

### 3.2 国内平台

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

## 4. 文本插入逻辑

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

## 5. 变量处理流程

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
          {['chatgpt', 'claude', 'gemini', 'deepseek', 'doubao', 'kimi', 'qwen', 'yiyan', 'yuanbao', 'chatglm'].map((p) => (
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

## 6. 标签页定位与重试策略

**⚠️ 评审纠正**：原设计的 `setTimeout 2s` 硬等待不可靠——ChatGPT 偶需 5+ 秒渲染完毕。改为带指数退避的重试循环。

**多标签页处理**：如果用户开了多个 ChatGPT 窗口，应弹窗让用户选择，而非强制选第一个。

```typescript
// src/services/insertService.ts

interface InsertResult { success: boolean; message: string; }

const DOMAIN_MAP: Record<string, string> = {
  chatgpt: 'chatgpt.com',
  claude: 'claude.ai',
  gemini: 'gemini.google.com',
  deepseek: 'chat.deepseek.com',
  doubao: 'www.doubao.com',
  kimi: 'kimi.moonshot.cn',
  qwen: 'tongyi.aliyun.com',
  yiyan: 'yiyan.baidu.com',
  yuanbao: 'yuanbao.tencent.com',
  chatglm: 'chatglm.cn',
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

### 6.1 Content Script Ready 协议

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

## 7. 所需权限变更

**⚠️ 评审提醒**：`tabs` 权限会让用户在安装时看到 **"Read your browsing history"** 警告，可能吓跑部分用户。这是 `chrome.tabs.query` 的硬依赖（`activeTab` 不足以查询非活跃标签页），功能价值大于风险，但需在商店描述中说明原因。

```json
{
  "permissions": ["tabs"],
  "host_permissions": [
    "https://api.anthropic.com/*",
    "https://api.openai.com/*"
  ],
  "optional_host_permissions": [
    "https://chatgpt.com/*",
    "https://claude.ai/*",
    "https://*.google.*/*",
    "https://chat.deepseek.com/*",
    "https://www.doubao.com/*",
    "https://kimi.moonshot.cn/*",
    "https://*.kimi.com/*",
    "https://tongyi.aliyun.com/*",
    "https://yiyan.baidu.com/*",
    "https://yuanbao.tencent.com/*",
    "https://chatglm.cn/*"
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

### 7.1 边角情况与降级策略

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

### 7.2 区域通配 Content Script

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

## 8. 文件清单

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

## 9. Vite 构建适配

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

## 10. 实施步骤

### 阶段一（本次）：ChatGPT + DeepSeek 验证

| 步骤 | 内容 | 预估工时 |
|------|------|---------|
| 1 | 创建 `content-scripts/insert.ts` + `dom-finders.ts`（ChatGPT + DeepSeek） | 1.5h |
| 2 | 创建独立 `vite.content.config.ts`（IIFE 构建） | 1h |
| 3 | 创建 `src/services/insertService.ts`（标签页管理 + message） | 1h |
| 4 | 创建 `src/components/insert/InsertDialog.tsx`（变量填写弹窗） | 1.5h |
| 5 | 修改 `PromptDetailPage.tsx` 工具栏集成插入按钮 | 0.5h |
| 6 | 修改 `public-ext/manifest.json`（tabs 权限 + content_scripts） | 0.5h |
| 7 | 构建 + 加载扩展验证（ChatGPT + DeepSeek 实际 DOM） | 1h |
| **阶段一小计** | | **约 7h** |

### 阶段二（后续）：追加剩余 8 个平台

| 步骤 | 内容 | 预估工时 |
|------|------|---------|
| 8 | Claude + Gemini 适配 | 1h |
| 9 | 豆包（Shadow DOM）+ Kimi + 通义千问适配 | 1.5h |
| 10 | 文心一言 + 元宝 + 智谱清言适配 | 1h |
| 11 | 端到端测试各平台插入 + 变量填写 | 2h |
| **总计** | | **约 12.5h** |

---

