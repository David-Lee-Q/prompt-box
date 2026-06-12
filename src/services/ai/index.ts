// Trigger self-registration of provider implementations
import './openai';
import './anthropic';

import type { AIProvider } from './provider';
import type { AIOptimizeRequest, AIStreamChunk, APIFormat, ProviderConfig } from '@/types/ai';
import { createProvider } from './registry';
import { AIError } from './errors';

// ── Provider Pool ──
const providerPool = new Map<string, AIProvider>();

// Module-level current pointer — set by settingsStore, never imports settingsStore
let current: { provider: AIProvider; id: string } | null = null;

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

export function setCurrentProvider(provider: AIProvider, id: string): void {
  current = { provider, id };
}

export function evictProvider(providerId: string): void {
  providerPool.delete(providerId);
  if (current?.id === providerId) current = null;
}

export function getCurrentProvider(): AIProvider | null {
  return current?.provider ?? null;
}

// ── Backward-compatible API ──

/** @deprecated — use settingsStore.setActiveProvider() instead */
export function initAI(settings: {
  format: APIFormat;
  apiKey: string;
  model: string;
  baseUrl?: string;
}): AIProvider {
  const id = `init-${settings.format}`;
  const existing = providerPool.get(id);
  if (existing) { providerPool.delete(id); }

  const provider = createProvider({
    type: settings.format,
    format: settings.format,
    apiKey: settings.apiKey,
    model: settings.model,
    baseUrl: settings.baseUrl,
  });
  providerPool.set(id, provider);
  current = { provider, id };
  return provider;
}

/** @deprecated — use getOrCreateProvider() via registry instead */
export function getAIProvider(
  format: APIFormat,
  apiKey: string,
  model: string,
  baseUrl?: string
): AIProvider {
  return createProvider({
    type: format,
    format,
    apiKey,
    model,
    baseUrl,
  });
}

// ── High-level methods (unchanged signatures) ──

function requireProvider(): AIProvider {
  const provider = getCurrentProvider();
  if (!provider) throw new AIError('AI 未配置，请在设置中配置 API Key', 'auth');
  if (!provider.getConfig().apiKey) throw new AIError('API Key 未设置', 'auth');
  return provider;
}

export async function optimizePrompt(
  request: AIOptimizeRequest,
  onChunk?: (chunk: AIStreamChunk) => void,
  signal?: AbortSignal
): Promise<string> {
  const provider = requireProvider();

  let systemPrompt: string;
  const dims = request.dimensions?.filter((d) => d.enabled);
  if (dims && dims.length > 0) {
    const diagnosticNotes = dims.map((d) => `- [${d.label}] ${d.findings}`).join('\n');
    systemPrompt =
      '你是 Prompt 工程专家。请运用你的专业判断力，根据以下 prompt 工程最佳实践优化用户的 Prompt。\n\n' +
      '## 优化原则\n' +
      '1. **明确性**：输出格式应根据任务选择并明确指定；约束条件量化且可验证；AI 角色定位清晰；边界和异常情况有处理逻辑。\n' +
      '2. **可操作性**：使用强动词直接指令；复杂任务分解为清晰步骤；输入与输出界限分明。\n' +
      '3. **Token 效率**：删除冗余表述、重复内容和多余的礼貌用语；用最少的词传达完整的指令。\n' +
      '4. **可读性**：结构层次分明；句子简洁易读；必要时添加示例。\n' +
      '5. **安全性**：移除可能被注入攻击的指令模式；脱敏真实个人信息。\n\n' +
      '## 诊断参考（仅供参考，非强制修改）\n' +
      '以下是从自动分析中发现的问题，请根据实际情况运用专业判断决定是否采纳及如何采纳：\n' +
      diagnosticNotes + '\n\n' +
      '## 输出要求\n' +
      '直接返回优化后的 Prompt 全文，保留原始 Prompt 的核心意图和任务目标。优化表达方式和结构，而非机械地逐条执行诊断建议。不要添加解释或前后缀。';
  } else {
    systemPrompt =
      '你是 Prompt 工程专家。请运用你的专业判断力，优化用户的 Prompt 使其更清晰、有效。\n\n' +
      '## 优化原则\n' +
      '1. **明确性**：输出格式根据任务选择并明确指定；约束条件量化可验证；角色定位清晰；边界情况有处理。\n' +
      '2. **可操作性**：使用强动词直接指令；复杂任务分解为步骤；输入输出界限分明。\n' +
      '3. **Token 效率**：删除冗余重复内容和多余礼貌用语。\n' +
      '4. **可读性**：结构层次分明；句子简洁易读；必要时添加示例。\n' +
      '5. **安全性**：移除注入攻击指令；脱敏真实个人信息。\n\n' +
      '## 输出要求\n' +
      '直接返回优化后的 Prompt 全文，不要添加解释或前后缀。';
  }

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    ...(request.context ? [{ role: 'user' as const, content: request.context }] : []),
    { role: 'user' as const, content: request.content },
    ...(request.instruction
      ? [{ role: 'user' as const, content: `额外要求：${request.instruction}` }]
      : []),
  ];

  if (onChunk) {
    return provider.streamChat(messages, (text) => {
      onChunk({ type: 'text', content: text });
    }, signal);
  }
  return provider.chat(messages, signal);
}

export async function generatePrompt(
  description: string,
  onChunk?: (chunk: AIStreamChunk) => void,
  signal?: AbortSignal
): Promise<string> {
  const provider = requireProvider();

  const systemPrompt =
    '你是一个 Prompt 生成专家。根据用户的需求描述，生成一个高质量的 Prompt。' +
    '确保包含角色设定、任务描述、输出格式等要素。直接返回 Prompt 内容。';

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: description },
  ];

  if (onChunk) {
    return provider.streamChat(messages, (text) => {
      onChunk({ type: 'text', content: text });
    }, signal);
  }
  return provider.chat(messages, signal);
}

const CANDIDATE_SYSTEM_PROMPT =
  '你是一个 Prompt 生成专家。根据用户的需求描述，生成 2-3 个不同的 Prompt 候选方案。' +
  '每个方案之间用 "---" 分隔。' +
  '每个方案应包含完整的角色设定、任务描述、输出格式引导和约束条件。' +
  '确保方案之间有明显的差异（如不同的表达风格、不同的结构组织方式）。' +
  '直接返回 Prompt 内容，不要添加额外解释。';

export async function generateCandidates(
  description: string,
  signal?: AbortSignal
): Promise<string> {
  const provider = requireProvider();

  return provider.chat(
    [
      { role: 'system', content: CANDIDATE_SYSTEM_PROMPT },
      { role: 'user', content: description },
    ],
    signal
  );
}

export function parseCandidates(text: string): string[] {
  // Try multiple split strategies — different models format separators differently
  // Try from most-specific to least-specific separator pattern
  const patterns = [/\n\n---\n\n/, /\n---\n/, /\n---/, /---\n/, /^---$/m, /---/];
  let parts: string[] = [];
  for (const re of patterns) {
    parts = text.split(re).filter(Boolean).map(p => p.trim()).filter(p => p.length > 10);
    if (parts.length >= 2) return parts;
  }
  // Fallback: if nothing works, treat the whole response as one candidate
  return [text.trim()].filter(p => p.length > 10);
}
