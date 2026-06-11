# P2-1：AI Provider 统一抽象层

> 2026-06-09

## Context

当前 AI Provider 层有三个结构性问题：

1. **全局单例**：`currentProvider` 是一个模块级 `let` 变量，每次 `initAI()` 覆盖。多 Provider 并行调用（如模型对比）需要手动创建临时 Provider 实例，绕过统一入口。
2. **硬编码分支**：`getAIProvider()` 用一个 `if/else` 选择 Provider 类型。新增 Provider（如 Google Gemini）必须修改核心文件。
3. **缺失通用能力**：无 `testConnection()` 方法（设置页自己拼 HTTP 请求）、无统一错误类型、`maxTokens`/`temperature` 等参数未传递。

## 现状追踪

### 当前架构

```
AIProvider 接口                               — src/services/ai/provider.ts:1-17
  方法: streamChat(), chat(), getConfig()

getAIProvider(format, apiKey, model, baseUrl) — src/services/ai/index.ts:8-18
  if format === 'anthropic' → new AnthropicProvider
  else → new OpenAIProvider                    ← 硬编码

currentProvider (let, 模块级)                  — src/services/ai/index.ts:6
  initAI() 设值，getCurrentProvider() 取值

APIFormat                                      — src/types/ai.ts:1
  type APIFormat = 'openai' | 'anthropic'      ← 只有 2 种

ProviderConfig                                 — src/types/ai.ts:3-10
  { id, name, format, apiKey, baseUrl, model }

settingsStore                                  — src/store/settingsStore.ts
  存 ProviderConfig[]，activeProviderId 选一个
  addProvider/updateProvider/removeProvider/setActiveProvider
  → 每次 setActiveProvider 调 initAI() 替换全局 currentProvider
```

### 关键问题汇总

| 问题 | 位置 | 影响 |
|------|------|------|
| 全局单例 | index.ts:6 | 并发场景不安全；模型对比需要绕过 |
| 硬编码 switch | index.ts:8-18 | 新增 Provider 需改核心文件 |
| 无 testConnection | 无 | AISettings 手写 HTTP，格式逻辑泄露到 UI |
| 无统一错误 | 无 | 上游需要分别处理 OpenAI/Anthropic 错误 |
| 参数未传递 | openai.ts:20, anthropic.ts:21 | temperature/maxTokens 硬编码 |
| 静默降级 | index.ts:16 | 不认识的 format 默认当 OpenAI，可能报错 |

## 目标行为

1. **Provider Registry**：注册机制，新增 Provider 只需实现接口 + 注册，不修改核心文件
2. **Provider Pool**：维护 `Map<providerId, AIProvider>`，支持多 Provider 并行调用
3. **统一接口扩展**：`testConnection()` / `listModels()` 加入接口
4. **错误标准化**：统一 `AIError` 类型
5. **配置穿透**：`temperature` / `maxTokens` 等参数从 config 传到 SDK

## 实现方案

### 1. 扩展 AIProvider 接口

**`src/services/ai/provider.ts`**：

```ts
export interface AIProvider {
  streamChat(messages: ChatMessage[], onChunk: (text: string) => void, signal?: AbortSignal): Promise<string>;
  chat(messages: ChatMessage[], signal?: AbortSignal): Promise<string>;
  testConnection(signal?: AbortSignal): Promise<{ ok: boolean; latency: number }>;
  getConfig(): AIProviderConfig;
}
```

### 2. Provider Registry

**新建 `src/services/ai/registry.ts`**：

```ts
type ProviderCtor = new (config: AIProviderConfig) => AIProvider;

const registry = new Map<string, ProviderCtor>();

export function registerProvider(format: string, ctor: ProviderCtor): void {
  registry.set(format, ctor);
}

export function createProvider(config: AIProviderConfig): AIProvider {
  const ctor = registry.get(config.format);
  if (!ctor) throw new Error(`Unknown provider format: ${config.format}`);
  return new ctor(config);
}
```

OpenAI 和 Anthropic Provider 在模块加载时自注册：
```ts
// openai.ts 底部
registerProvider('openai', (cfg) => new OpenAIProvider(cfg));
// anthropic.ts 底部
registerProvider('anthropic', (cfg) => new AnthropicProvider(cfg));
```

### 3. Provider Pool（替代全局单例）

**改造 `src/services/ai/index.ts`**：

```ts
// 替代原来的 let currentProvider
const providerPool = new Map<string, AIProvider>();

export function getOrCreateProvider(config: ProviderConfig): AIProvider {
  const key = config.id;
  if (!providerPool.has(key)) {
    providerPool.set(key, createProvider({
      type: config.format,
      format: config.format,
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl || undefined,
    }));
  }
  return providerPool.get(key)!;
}

export function evictProvider(providerId: string): void {
  providerPool.delete(providerId);
}

// 保持向后兼容
export function getCurrentProvider(): AIProvider | null {
  const { providers, activeProviderId } = useSettingsStore.getState();
  if (!activeProviderId) return null;
  const config = providers.find((p) => p.id === activeProviderId);
  if (!config) return null;
  return getOrCreateProvider(config);
}
```

### 4. 配置穿透

**`src/types/ai.ts`** — AIProviderConfig 扩展：

```ts
export interface AIProviderConfig {
  type: string;
  format: APIFormat;
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;    // 新增
  maxTokens?: number;      // 新增
  topP?: number;           // 新增
}
```

OpenAIProvider/AnthropicProvider 构造函数接收完整 config 并将 `temperature`/`maxTokens` 传给 SDK 调用。

### 5. 统一错误类型

**新建 `src/services/ai/errors.ts`**：

```ts
export class AIError extends Error {
  constructor(
    message: string,
    public code: 'auth' | 'rate_limit' | 'timeout' | 'network' | 'server' | 'unknown',
    public statusCode?: number,
    public providerRaw?: unknown
  ) {
    super(message);
    this.name = 'AIError';
  }
}
```

两个 Provider 的 SDK 调用包裹 try/catch，将原生错误映射为 `AIError`。

### 6. testConnection 实现

```ts
// OpenAIProvider
async testConnection(signal?: AbortSignal): Promise<{ ok: boolean; latency: number }> {
  const start = Date.now();
  try {
    await this.client.models.list({ signal });
    return { ok: true, latency: Date.now() - start };
  } catch (e) {
    return { ok: false, latency: Date.now() - start };
  }
}

// AnthropicProvider
async testConnection(signal?: AbortSignal): Promise<{ ok: boolean; latency: number }> {
  const start = Date.now();
  try {
    await this.client.messages.create({
      model: this.config.model,
      max_tokens: 1,
      messages: [{ role: 'user', content: 'Hi' }],
    }, signal ? { signal } : undefined);
    return { ok: true, latency: Date.now() - start };
  } catch (e) {
    return { ok: false, latency: Date.now() - start };
  }
}
```

`AISettings.tsx` 的连接测试改为调用 `provider.testConnection()`，不再手写 HTTP 请求。

### 7. APIFormat 扩展

```ts
export type APIFormat = 'openai' | 'anthropic' | 'google' | 'ollama' | 'custom';
```

- `google` / `ollama` 为后续扩展预留，当前不实现具体 Provider
- `custom` 用于用户自建兼容端点

## 向后兼容策略

- `initAI()` 保留但标记 `@deprecated`，内部转调 `getOrCreateProvider()`
- `getAIProvider()` 改为从 registry 创建，不再硬编码 switch
- `getCurrentProvider()` 行为不变但内部改用 Pool
- 所有调用方（optimizePrompt/generatePrompt/generateCandidates/TestPanel/MultiModelTest）无需改动

## 文件变更

| 文件 | 改动 |
|------|------|
| `src/services/ai/provider.ts` | AIProvider 接口 +`testConnection` |
| `src/services/ai/registry.ts` | **新建** — registerProvider / createProvider |
| `src/services/ai/errors.ts` | **新建** — AIError 统一错误类 |
| `src/services/ai/index.ts` | Provider Pool 替代全局单例；保留向后兼容 |
| `src/services/ai/openai.ts` | 构造函数接收完整 config；+testConnection；+自注册；错误映射 AIError |
| `src/services/ai/anthropic.ts` | 同上 |
| `src/types/ai.ts` | AIProviderConfig 扩展 temperature/maxTokens；APIFormat 扩展 |
| `src/components/settings/AISettings.tsx` | 连接测试改用 provider.testConnection() |
| `src/store/settingsStore.ts` | 小改：updateProvider 时 evict 旧 Provider |

## 验证

1. 添加 OpenAI 兼容 Provider → 测试连接正常 → AI 优化/生成可用
2. 添加 Anthropic Provider → 测试连接正常 → AI 优化/生成可用
3. 模型对比同时使用两个不同 Provider → 并行调用无冲突
4. 错误的 API Key → 测试连接返回 `{ ok: false }` → UI 显示友好错误
5. 网络超时 → 抛出 `AIError { code: 'timeout' }` → 上游捕获并提示
6. 修改 Provider 配置 → 旧 Provider 实例被 evict → 下次调用用新配置创建

---

## 评审发现与修订 (2026-06-09)

### 1. 环形依赖（阻断）

**问题**：`getCurrentProvider()` 调 `useSettingsStore.getState()` 创建 `index.ts → settingsStore.ts → index.ts` 环形依赖。`settingsStore.ts:3` 已有 `import { initAI } from '@/services/ai'`。

**修正**：`getCurrentProvider()` **不从 store 读取**。改为由 store 在 `setActiveProvider` 时主动调用 `getOrCreateProvider(config)` 并将结果注入到服务层。服务层暴露 `setCurrentProviderId(id)` 而非从 store 拉取：
```ts
// settingsStore.ts (保留现有逻辑)
setActiveProvider: (id) => {
  const config = get().providers.find(p => p.id === id);
  if (config) {
    const provider = getOrCreateProvider(config);
    setCurrentProvider(provider, id);  // 单向注入，避免反向依赖
  }
}
```

### 2. 构造函数签名迁移路径

**问题**：两个 Provider 构造函数从 `(apiKey, model, baseUrl?)` 改为 `(config: AIProviderConfig)` 会破坏所有现有调用方。

**修正**：保留旧构造函数签名，新增静态工厂方法：
```ts
static fromConfig(config: AIProviderConfig): OpenAIProvider {
  return new OpenAIProvider(config.apiKey, config.model, config.baseUrl);
}
```
Registry 注册工厂方法而非构造函数。旧调用方（`getAIProvider`、`MultiModelTest`）不受影响。

### 3. temperature/maxTokens 缺少 UI 路径

**问题**：`AIProviderConfig` 已有 `maxTokens?`/`temperature?` 字段但从未使用。`ProviderConfig`（UI 层）无这些字段。

**修正**：在 `ProviderConfig` 中新增 `temperature?: number` 和 `maxTokens?: number`。在 `AISettings.tsx` 的提供商编辑表单中增加可折叠的"高级参数"区域，包含 temperature（滑块 0-2，步长 0.1）和 maxTokens（数字输入 100-128000）。

### 4. 流式错误 catch 的边界

**问题**：try/catch 包裹整个 streamChat 方法会导致 onChunk 回调中的 React 状态更新错误被误归类为 AI 错误。

**修正**：仅 catch SDK 调用本身（`this.client.chat.completions.create(...)` / `stream.finalMessage()`），onChunk 回调在 catch 块外部。Anthropic 现有的 try/finally 结构保持不变，仅在其外层增加对 `finalMessage()` 的 error mapping。
