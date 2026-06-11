import { describe, it, expect } from 'vitest';
import { AIError } from './errors';

describe('AIError', () => {
  it('sets name to AIError', () => {
    const e = new AIError('test', 'auth');
    expect(e.name).toBe('AIError');
    expect(e instanceof Error).toBe(true);
  });

  it('stores all properties', () => {
    const raw = { status: 429, message: 'too many' };
    const e = new AIError('rate limit hit', 'rate_limit', 429, raw);
    expect(e.message).toBe('rate limit hit');
    expect(e.code).toBe('rate_limit');
    expect(e.statusCode).toBe(429);
    expect(e.providerRaw).toBe(raw);
  });

  it('supports undefined optional fields', () => {
    const e = new AIError('unknown error', 'unknown');
    expect(e.statusCode).toBeUndefined();
    expect(e.providerRaw).toBeUndefined();
  });
});
