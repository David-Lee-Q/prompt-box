import { describe, it, expect } from 'vitest';
// Trigger self-registration of real providers
import './openai';
import './anthropic';
import { getOrCreateProvider, setCurrentProvider, getCurrentProvider, evictProvider, initAI, getAIProvider } from './index';
import type { ProviderConfig } from '@/types/ai';

const makeConfig = (overrides?: Partial<ProviderConfig>): ProviderConfig => ({
  id: 'test-1',
  name: 'Test',
  format: 'openai',
  apiKey: 'sk-test',
  baseUrl: '',
  model: 'gpt-4o',
  ...overrides,
});

describe('Provider Pool', () => {
  it('getOrCreateProvider creates and caches', () => {
    const config = makeConfig();
    const a = getOrCreateProvider(config);
    const b = getOrCreateProvider(config);
    expect(a).toBe(b); // same instance from cache
  });

  it('evictProvider removes from pool', () => {
    const config = makeConfig({ id: 'to-evict' });
    const a = getOrCreateProvider(config);
    evictProvider('to-evict');

    const b = getOrCreateProvider(config);
    expect(a).not.toBe(b); // new instance after eviction
  });

  it('evictProvider clears current if evicted', () => {
    const config = makeConfig({ id: 'active-evict' });
    const p = getOrCreateProvider(config);
    setCurrentProvider(p, 'active-evict');
    expect(getCurrentProvider()).toBe(p);

    evictProvider('active-evict');
    expect(getCurrentProvider()).toBeNull();
  });

  it('setCurrentProvider / getCurrentProvider roundtrip', () => {
    const config = makeConfig({ id: 'current-test' });
    const p = getOrCreateProvider(config);
    setCurrentProvider(p, 'current-test');
    expect(getCurrentProvider()).toBe(p);
  });
});

describe('Backward compat: initAI', () => {
  it('creates and sets current provider', () => {
    const p = initAI({ format: 'openai', apiKey: 'sk-x', model: 'gpt-4o' });
    expect(p).toBeDefined();
    expect(getCurrentProvider()).toBe(p);
    expect(p.getConfig().format).toBe('openai');
  });

  it('replaces provider on second call', () => {
    const a = initAI({ format: 'openai', apiKey: 'sk-a', model: 'gpt-4o' });
    const b = initAI({ format: 'anthropic', apiKey: 'sk-b', model: 'claude' });
    expect(a).not.toBe(b);
    expect(getCurrentProvider()).toBe(b);
    expect(b.getConfig().format).toBe('anthropic');
  });
});

describe('Backward compat: getAIProvider', () => {
  it('creates provider without caching', () => {
    const a = getAIProvider('openai', 'sk-1', 'gpt-4o');
    const b = getAIProvider('openai', 'sk-1', 'gpt-4o');
    expect(a).not.toBe(b); // no caching — each call creates new instance
  });

  it('throws for unknown format', () => {
    expect(() => getAIProvider('unknown' as any, 'k', 'm')).toThrow('Unknown provider format');
  });
});
