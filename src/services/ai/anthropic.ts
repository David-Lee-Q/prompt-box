import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider } from './provider';
import type { AIProviderConfig } from '@/types/ai';
import type { ChatMessage } from './types';
import { createProxyFetch } from './fetchWithProxy';
import { registerProvider } from './registry';
import { AIError, type AIErrorCode } from './errors';
import { stripThinkBlocks } from './thinkFilter';

export function mapAnthropicError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new AIError('请求已取消', 'timeout');
  }
  if (err && typeof err === 'object' && 'status' in err) {
    const e = err as { status: number; message?: string; type?: string };
    const code: AIErrorCode =
      e.status === 401 || e.status === 403 ? 'auth' :
      e.status === 429 ? 'rate_limit' :
      e.status >= 500 ? 'server' : 'unknown';
    return new AIError(e.message || 'Anthropic API error', code, e.status, err);
  }
  if (err instanceof TypeError) {
    return new AIError('网络请求失败，请检查网络或 API 地址', 'network');
  }
  return new AIError(err instanceof Error ? err.message : '未知错误', 'unknown');
}

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;
  private config: AIProviderConfig;
  private maxTokens: number;

  constructor(apiKey: string, model: string, baseUrl?: string) {
    this.config = {
      type: 'anthropic',
      format: 'anthropic',
      apiKey,
      model,
      baseUrl,
    };
    this.maxTokens = 4096;
    this.client = new Anthropic({
      apiKey,
      baseURL: baseUrl || undefined,
      dangerouslyAllowBrowser: true,
      fetch: createProxyFetch(),
    });
  }

  static fromConfig(config: AIProviderConfig): AnthropicProvider {
    return new AnthropicProvider(config.apiKey, config.model, config.baseUrl);
  }

  private getMaxTokens(): number {
    return this.config.maxTokens ?? this.maxTokens;
  }

  private splitMessages(messages: ChatMessage[]): {
    system?: string;
    chatMessages: { role: 'user' | 'assistant'; content: string }[];
  } {
    const systemMsg = messages.find((m) => m.role === 'system');
    const chatMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));
    return { system: systemMsg?.content, chatMessages };
  }

  async streamChat(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    const { system, chatMessages } = this.splitMessages(messages);

    const stream = this.client.messages.stream({
      model: this.config.model,
      max_tokens: this.getMaxTokens(),
      messages: chatMessages,
      ...(system ? { system } : {}),
      ...(this.config.temperature != null ? { temperature: this.config.temperature } : {}),
    });

    const onAbort = () => stream.controller.abort();
    if (signal) signal.addEventListener('abort', onAbort);

    let fullText = '';
    stream.on('text', (text) => {
      fullText += text;
      onChunk(text);
    });

    try {
      await stream.finalMessage();
    } catch (err) {
      throw mapAnthropicError(err);
    } finally {
      if (signal) signal.removeEventListener('abort', onAbort);
    }
    return stripThinkBlocks(fullText);
  }

  async chat(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): Promise<string> {
    try {
      const { system, chatMessages } = this.splitMessages(messages);

      const response = await this.client.messages.create(
        {
          model: this.config.model,
          max_tokens: this.getMaxTokens(),
          messages: chatMessages,
          ...(system ? { system } : {}),
          ...(this.config.temperature != null ? { temperature: this.config.temperature } : {}),
        },
        signal ? { signal } : undefined
      );

      const block = response.content[0];
      return stripThinkBlocks(block?.type === 'text' ? block.text : '');
    } catch (err) {
      throw mapAnthropicError(err);
    }
  }

  async testConnection(signal?: AbortSignal): Promise<{ ok: boolean; latency: number; error?: string }> {
    const start = Date.now();
    try {
      await this.client.messages.create({
        model: this.config.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }, signal ? { signal } : undefined);
      return { ok: true, latency: Date.now() - start };
    } catch (err) {
      const mapped = mapAnthropicError(err);
      return { ok: false, latency: Date.now() - start, error: mapped.message };
    }
  }

  getConfig(): AIProviderConfig {
    return { ...this.config };
  }
}

registerProvider('anthropic', AnthropicProvider.fromConfig);
