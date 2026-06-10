import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider } from './provider';
import type { AIProviderConfig } from '@/types/ai';
import type { ChatMessage } from './types';
import { createProxyFetch } from './fetchWithProxy';
import { stripThinkBlocks } from './thinkFilter';

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
      max_tokens: this.maxTokens,
      messages: chatMessages,
      ...(system ? { system: system } : {}),
    });

    const onAbort = () => stream.controller.abort();
    if (signal) {
      signal.addEventListener('abort', onAbort);
    }

    let fullText = '';
    stream.on('text', (text) => {
      fullText += text;
      onChunk(text);
    });

    try {
      await stream.finalMessage();
    } finally {
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }
    }
    return stripThinkBlocks(fullText);
  }

  async chat(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): Promise<string> {
    const { system, chatMessages } = this.splitMessages(messages);

    const response = await this.client.messages.create(
      {
        model: this.config.model,
        max_tokens: this.maxTokens,
        messages: chatMessages,
        ...(system ? { system: system } : {}),
      },
      signal ? { signal } : undefined
    );

    const block = response.content[0];
    return stripThinkBlocks(block?.type === 'text' ? block.text : '');
  }

  getConfig(): AIProviderConfig {
    return { ...this.config };
  }
}
