import OpenAI from 'openai';
import type { AIProvider } from './provider';
import type { AIProviderConfig } from '@/types/ai';
import type { ChatMessage } from './types';
import { createProxyFetch } from './fetchWithProxy';
import { registerProvider } from './registry';
import { AIError, type AIErrorCode } from './errors';
import { stripThinkBlocks } from './thinkFilter';

function mapOpenAIError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new AIError('请求已取消', 'timeout');
  }
  if (err && typeof err === 'object' && 'status' in err) {
    const e = err as { status: number; message?: string; code?: string };
    const code: AIErrorCode =
      e.status === 401 || e.status === 403 ? 'auth' :
      e.status === 429 ? 'rate_limit' :
      e.status >= 500 ? 'server' : 'unknown';
    return new AIError(e.message || 'OpenAI API error', code, e.status, err);
  }
  if (err instanceof TypeError) {
    return new AIError('网络请求失败，请检查网络或 API 地址', 'network');
  }
  return new AIError(err instanceof Error ? err.message : '未知错误', 'unknown');
}

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;
  private config: AIProviderConfig;

  constructor(apiKey: string, model: string, baseUrl?: string) {
    this.config = {
      type: 'openai',
      format: 'openai',
      apiKey,
      model,
      baseUrl,
    };
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl || undefined,
      dangerouslyAllowBrowser: true,
      fetch: createProxyFetch(),
    });
  }

  static fromConfig(config: AIProviderConfig): OpenAIProvider {
    return new OpenAIProvider(config.apiKey, config.model, config.baseUrl);
  }

  async streamChat(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
    try {
      const stream = await this.client.chat.completions.create(
        {
          model: this.config.model,
          messages: messages.map((m) => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          })),
          stream: true,
          ...(this.config.temperature != null ? { temperature: this.config.temperature } : {}),
          ...(this.config.maxTokens != null ? { max_tokens: this.config.maxTokens } : {}),
        },
        { signal }
      );

      let fullText = '';
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullText += content;
          onChunk(content);
        }
      }
      return stripThinkBlocks(fullText);
    } catch (err) {
      throw mapOpenAIError(err);
    }
  }

  async chat(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): Promise<string> {
    try {
      const response = await this.client.chat.completions.create(
        {
          model: this.config.model,
          messages: messages.map((m) => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          })),
          ...(this.config.temperature != null ? { temperature: this.config.temperature } : {}),
          ...(this.config.maxTokens != null ? { max_tokens: this.config.maxTokens } : {}),
        },
        { signal }
      );
      return stripThinkBlocks(response.choices[0]?.message?.content ?? '');
    } catch (err) {
      throw mapOpenAIError(err);
    }
  }

  async testConnection(signal?: AbortSignal): Promise<{ ok: boolean; latency: number }> {
    const start = Date.now();
    try {
      await this.client.models.list({ signal });
      return { ok: true, latency: Date.now() - start };
    } catch {
      return { ok: false, latency: Date.now() - start };
    }
  }

  getConfig(): AIProviderConfig {
    return { ...this.config };
  }
}

registerProvider('openai', OpenAIProvider.fromConfig);
