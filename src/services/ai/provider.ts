import type { AIProviderConfig } from '@/types/ai';
import type { ChatMessage } from './types';

export interface AIProvider {
  streamChat(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    signal?: AbortSignal
  ): Promise<string>;

  chat(
    messages: ChatMessage[],
    signal?: AbortSignal
  ): Promise<string>;

  getConfig(): AIProviderConfig;
}
