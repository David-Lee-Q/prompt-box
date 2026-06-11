# P2-2：导出为 Agent 工具配置

> 摘自 v2.0-P2 详细开发计划 Step 12 | 2026-06-09

## Context

将 Prompt 导出为标准化的 Agent 工具定义格式（OpenAI function calling 或 Anthropic tool use），让用户可以直接在 AI Agent 框架中使用这些 Prompt。纯数据格式转换，不依赖任何 AI API，可最先开发。

## 当前状态

无此功能。用户只能在 Prompt Manager 内部使用 Prompt，无法导出到外部 Agent 框架。

## 目标行为

1. Prompt 详情页操作栏增加"导出工具"入口
2. 弹出对话框，支持 4 种导出格式选择
3. 预览导出结果（JSON 或 TypeScript 代码）
4. 复制到剪贴板或下载文件

## 涉及文件

| 操作 | 文件路径 | 说明 |
|------|---------|------|
| 新增 | `src/utils/agent-export.ts` | 导出核心逻辑 |
| 新增 | `src/components/ai/AgentExportDialog.tsx` | 导出对话框 |
| 修改 | `src/pages/PromptDetailPage.tsx` | 添加导出入口 |

## 实现方案

### 1. 核心类型 — `src/types/ai.ts` 补充

```typescript
export interface AgentToolConfig {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
    handler?: string;
  };
}

export interface AnthropicToolConfig {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export type AgentExportFormat = 'openai-fc' | 'anthropic-tools' | 'openai-sdk' | 'langchain';

export interface AgentExportResult {
  format: AgentExportFormat;
  content: string;
  filename: string;
}
```

### 2. 导出逻辑 — `src/utils/agent-export.ts`

核心函数 `exportAsAgentTool(options)` 根据 `format` 参数分派到四个导出器：

- `exportOpenAIFunctionCalling()` — 生成 JSON 格式 function calling 定义，变量 → `parameters.properties`
- `exportAnthropicTool()` — 生成 JSON 格式 tool use 定义，变量 → `input_schema.properties`
- `exportOpenAISDK()` — 生成 TypeScript SDK 调用代码（含 import + tool 对象 + usage comment）
- `exportLangChain()` — 生成 LangChain `StructuredTool` 类（含 Zod schema + `_call` 占位）

辅助函数：`toCamelCase()`、`pascalCase()`、`truncate()`

### 3. AgentExportDialog 组件

```
┌─────────────────────────────────────────┐
│  导出为 Agent 工具                  [✕]  │
├─────────────────────────────────────────┤
│  提示词：营销文案生成器                   │
│  版本：v1.0.3                           │
│  变量：{语气} {平台} {主题}              │
│                                         │
│  导出格式：                              │
│  ○ OpenAI Function Calling              │
│  ○ Anthropic Tool Use                   │
│  ● OpenAI SDK (TypeScript)              │
│  ○ LangChain Tool                       │
│                                         │
│  ☑ 包含变量参数                          │
│  ☐ 包含 Handler 占位代码                │
│                                         │
│  ┌── 预览 ───────────────────────────┐  │
│  │ [实时预览导出结果]                  │  │
│  └────────────────────────────────────┘  │
│                                         │
│  [复制]  [下载文件]                      │
└─────────────────────────────────────────┘
```

Props：
```typescript
interface AgentExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Prompt;
  version?: Version;
  variables: string[];
}
```

### 4. PromptDetailPage 入口

```tsx
<button
  onClick={() => setShowAgentExport(true)}
  className="flex items-center gap-1 text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors active:scale-[0.95]"
  title="导出为 Agent 工具配置"
>
  <Bot className="h-3.5 w-3.5" />
  导出工具
</button>
```

### 5. 导出格式对比

| 格式 | 输出类型 | 适用场景 |
|------|---------|---------|
| OpenAI Function Calling | JSON | 直接用于 OpenAI API 的 `tools` 参数 |
| Anthropic Tool Use | JSON | 直接用于 Anthropic API 的 `tools` 参数 |
| OpenAI SDK | TypeScript | 复制到 Node.js/Deno 项目中使用 |
| LangChain | TypeScript | LangChain 框架的 StructuredTool 类 |

### 6. 数据流

```
用户点击 [导出工具]
       ↓
AgentExportDialog 弹出
       ↓
用户选择导出格式
       ↓
实时预览导出结果
       ↓
用户选择 [复制] 或 [下载]
```

## 文件变更

| 文件 | 改动 |
|------|------|
| `src/utils/agent-export.ts` | **新建** — 导出核心逻辑（~180 行） |
| `src/components/ai/AgentExportDialog.tsx` | **新建** — 导出对话框 UI |
| `src/pages/PromptDetailPage.tsx` | +导出工具入口按钮 |
| `src/types/ai.ts` | +AgentToolConfig / AnthropicToolConfig / AgentExportFormat / AgentExportResult 类型 |

## 依赖

无新增 npm 依赖。纯 JSON/TS 字符串生成，不需要外部库。

## 验证

1. 打开有变量的 Prompt → 点击"导出工具"
2. 切换 4 种格式 → 预览区内容正确更新
3. 复制按钮 → 内容复制到剪贴板
4. 下载按钮 → 文件下载正确（文件名符合格式规范）
5. 无变量的 Prompt → 自动使用 `content` 作为默认参数
