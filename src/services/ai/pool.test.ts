import { describe, it, expect, vi, beforeEach } from 'vitest';
// Trigger self-registration of real providers
import './openai';
import './anthropic';
import { getOrCreateProvider, getCurrentProvider, evictProvider, initAI, getAIProvider } from './index';
import type { ProviderConfig } from '@/types/ai';

// Mock settingsStore to provide active provider for getCurrentProvider()
const mockGetState = vi.fn(() => ({ activeProvider: null }));
vi.mock('@/store/settingsStore', () => ({
  default: { getState: () => mockGetState() },
}));

beforeEach(() => {
  mockGetState.mockReturnValue({ activeProvider: null });
});

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

  it('evictProvider removes from pool (store-based getCurrentProvider)', () => {
    const config = makeConfig({ id: 'to-evict2' });
    const p = getOrCreateProvider(config);
    mockGetState.mockReturnValue({ activeProvider: config });
    expect(getCurrentProvider()).toBe(p); // from pool cache

    evictProvider('to-evict2');
    const q = getOrCreateProvider(config);
    expect(q).not.toBe(p); // new instance after eviction
  });

  it('getCurrentProvider returns null when store has no active', () => {
    mockGetState.mockReturnValue({ activeProvider: null });
    expect(getCurrentProvider()).toBeNull();
  });
});

describe('Backward compat: initAI', () => {
  it('creates provider with correct format', () => {
    const p = initAI({ format: 'openai', apiKey: 'sk-x', model: 'gpt-4o' });
    expect(p).toBeDefined();
    expect(p.getConfig().format).toBe('openai');
  });

  it('replaces provider on second call', () => {
    const a = initAI({ format: 'openai', apiKey: 'sk-a', model: 'gpt-4o' });
    const b = initAI({ format: 'anthropic', apiKey: 'sk-b', model: 'claude' });
    expect(a).not.toBe(b);
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
