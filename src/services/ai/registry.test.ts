import { describe, it, expect, beforeEach } from 'vitest';
import { registerProvider, createProvider } from './registry';
import type { AIProvider } from './provider';
import type { AIProviderConfig, APIFormat } from '@/types/ai';
import type { ChatMessage } from './types';

// Simple mock provider for testing
class MockProvider implements AIProvider {
  constructor(public config: AIProviderConfig) {}

  async streamChat(messages: ChatMessage[], onChunk: (text: string) => void): Promise<string> {
    onChunk('streamed');
    return 'streamed';
  }

  async chat(): Promise<string> {
    return 'ok';
  }

  async testConnection(): Promise<{ ok: boolean; latency: number }> {
    return { ok: true, latency: 10 };
  }

  getConfig(): AIProviderConfig {
    return { ...this.config };
  }
}

describe('Provider Registry', () => {
  beforeEach(() => {
    // re-register mock each test
    registerProvider('mock', (cfg) => new MockProvider(cfg));
  });

  it('createProvider returns instance for registered format', () => {
    const config: AIProviderConfig = {
      type: 'mock', format: 'mock' as APIFormat, apiKey: 'k', model: 'm',
    };
    const p = createProvider(config);
    expect(p).toBeInstanceOf(MockProvider);
  });

  it('createProvider passes config to factory', () => {
    const config: AIProviderConfig = {
      type: 'mock', format: 'mock' as APIFormat, apiKey: 'key-1', model: 'gpt-x',
      temperature: 0.7, maxTokens: 2048,
    };
    const p = createProvider(config) as MockProvider;
    const cfg = p.getConfig();
    expect(cfg.apiKey).toBe('key-1');
    expect(cfg.model).toBe('gpt-x');
    expect(cfg.temperature).toBe(0.7);
    expect(cfg.maxTokens).toBe(2048);
  });

  it('createProvider throws for unknown format', () => {
    const config: AIProviderConfig = {
      type: 'unknown', format: 'unknown' as APIFormat, apiKey: 'k', model: 'm',
    };
    expect(() => createProvider(config)).toThrow('Unknown provider format');
  });

  it('registerProvider overrides existing format', () => {
    let calls = 0;
    registerProvider('mock', () => {
      calls++;
      return new MockProvider({ type: 'mock', format: 'mock' as APIFormat, apiKey: 'k', model: 'm' });
    });
    expect(() => createProvider({ type: 'mock', format: 'mock' as APIFormat, apiKey: 'k', model: 'm' })).not.toThrow();
    expect(calls).toBe(1);
  });
});
