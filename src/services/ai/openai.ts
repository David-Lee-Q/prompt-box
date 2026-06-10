import OpenAI from 'openai';
import type { AIProvider } from './provider';
import type { AIProviderConfig } from '@/types/ai';
import type { ChatMessage } from './types';
import { createProxyFetch } from './fetchWithProxy';
import { stripThinkBlocks } from './thinkFilter';

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

  async streamChat(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<string> {
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

    let fullText = '';
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullText += content;
        onChunk(content);
      }
    }
    return stripThinkBlocks(fullText);
  }

  async chat(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): Promise<string> {
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
  }

  getConfig(): AIProviderConfig {
    return { ...this.config };
  }
}
