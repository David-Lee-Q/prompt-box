import OpenAI from 'openai';
import type { AIProvider } from './provider';
import type { AIProviderConfig } from '@/types/ai';
import type { ChatMessage } from './types';
import { createProxyFetch } from './fetchWithProxy';
import { registerProvider } from './registry';
import { AIError, type AIErrorCode } from './errors';
import { stripThinkBlocks } from './thinkFilter';

export function mapOpenAIError(err: unknown): AIError {
  if (err instanceof AIError) return err;
  if (err instanceof DOMException && err.name === 'AbortError') {
    return new AIError('请求已取消', 'cancelled');
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
    if (err.message === 'Failed to fetch' || err.message.includes('fetch')) {
      return new AIError('网络请求失败，请检查网络或 API 地址', 'network');
    }
    console.error('[OpenAI] unexpected TypeError:', err);
    return new AIError(err.message, 'unknown');
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
    let fullText = '';
    try {
      const stream = await this.client.chat.completions.create(
        {
          model: this.config.model,
          messages: messages.map((m) => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          })),
          stream: true,
        },
        { signal }
      );

      let lastCleaned = 0;
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          fullText += content;
          const cleaned = stripThinkBlocks(fullText);
          const delta = cleaned.slice(lastCleaned);
          if (delta) onChunk(delta);
          lastCleaned = cleaned.length;
        }
      }
      return stripThinkBlocks(fullText);
    } catch (err) {
      if (fullText) return stripThinkBlocks(fullText); // return partial content on stream interruption
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
        },
        { signal }
      );
      return stripThinkBlocks(response.choices[0]?.message?.content ?? '');
    } catch (err) {
      throw mapOpenAIError(err);
    }
  }

  async testConnection(signal?: AbortSignal): Promise<{ ok: boolean; latency: number; error?: string }> {
    // Use minimal chat completion (POST) rather than models.list (GET),
    // because the Vite dev proxy only forwards POST requests.
    if (signal?.aborted) return { ok: false, latency: 0, error: '请求已取消' };
    const start = Date.now();
    const internalCtrl = new AbortController();
    const timeout = setTimeout(() => internalCtrl.abort(), 20000);
    const onExternalAbort = () => internalCtrl.abort();
    try {
      if (signal) signal.addEventListener('abort', onExternalAbort, { once: true });
      await this.client.chat.completions.create({
        model: this.config.model,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'Hi' }],
      }, { signal: internalCtrl.signal });
      return { ok: true, latency: Date.now() - start };
    } catch (err) {
      const mapped = mapOpenAIError(err);
      return { ok: false, latency: Date.now() - start, error: mapped.message };
    } finally {
      clearTimeout(timeout);
      if (signal) signal.removeEventListener('abort', onExternalAbort);
    }
  }

  getConfig(): AIProviderConfig {
    return { ...this.config };
  }
}

registerProvider('openai', OpenAIProvider.fromConfig);
