import { describe, it, expect } from 'vitest';
import { AIError } from './errors';
import { mapOpenAIError } from './openai';
import { mapAnthropicError } from './anthropic';

function apiError(status: number, message = 'api error') {
  return { status, message };
}

function networkTypeError() {
  return new TypeError('Failed to fetch');
}

function abortError() {
  return new DOMException('The operation was aborted.', 'AbortError');
}

describe('mapOpenAIError', () => {
  it('passes through AIError unchanged', () => {
    const e = new AIError('original', 'auth');
    expect(mapOpenAIError(e)).toBe(e);
  });

  it('maps 401 to auth', () => {
    const e = mapOpenAIError({ status: 401, message: 'Unauthorized' });
    expect(e.code).toBe('auth');
    expect(e.statusCode).toBe(401);
    expect(e.message).toBe('Unauthorized');
  });

  it('maps 403 to auth', () => {
    const e = mapOpenAIError(apiError(403, 'Forbidden'));
    expect(e.code).toBe('auth');
  });

  it('maps 429 to rate_limit', () => {
    const e = mapOpenAIError(apiError(429, 'Too many'));
    expect(e.code).toBe('rate_limit');
  });

  it('maps 500 to server', () => {
    expect(mapOpenAIError(apiError(500)).code).toBe('server');
    expect(mapOpenAIError(apiError(502)).code).toBe('server');
    expect(mapOpenAIError(apiError(503)).code).toBe('server');
  });

  it('maps 400 to unknown', () => {
    expect(mapOpenAIError(apiError(400)).code).toBe('unknown');
  });

  it('maps 404 to unknown', () => {
    expect(mapOpenAIError(apiError(404)).code).toBe('unknown');
  });

  it('maps TypeError to network', () => {
    const e = mapOpenAIError(networkTypeError());
    expect(e.code).toBe('network');
    expect(e.message).toContain('网络');
  });

  it('maps AbortError to cancelled', () => {
    const e = mapOpenAIError(abortError());
    expect(e.code).toBe('cancelled');
  });

  it('maps plain Error to unknown', () => {
    const e = mapOpenAIError(new Error('something broke'));
    expect(e.code).toBe('unknown');
    expect(e.message).toBe('something broke');
  });

  it('stores providerRaw on API errors', () => {
    const raw = { status: 429, message: 'rate' };
    expect(mapOpenAIError(raw).providerRaw).toBe(raw);
  });
});

describe('mapAnthropicError', () => {
  it('passes through AIError unchanged', () => {
    const e = new AIError('original', 'rate_limit');
    expect(mapAnthropicError(e)).toBe(e);
  });

  it('maps 401 to auth', () => {
    const e = mapAnthropicError(apiError(401, 'Invalid key'));
    expect(e.code).toBe('auth');
    expect(e.statusCode).toBe(401);
  });

  it('maps 403 to auth', () => {
    const e = mapAnthropicError(apiError(403));
    expect(e.code).toBe('auth');
  });

  it('maps 429 to rate_limit', () => {
    const e = mapAnthropicError(apiError(429));
    expect(e.code).toBe('rate_limit');
  });

  it('maps 500+ to server', () => {
    expect(mapAnthropicError(apiError(500)).code).toBe('server');
    expect(mapAnthropicError(apiError(503)).code).toBe('server');
  });

  it('maps TypeError to network', () => {
    const e = mapAnthropicError(networkTypeError());
    expect(e.code).toBe('network');
  });

  it('maps AbortError to cancelled', () => {
    const e = mapAnthropicError(abortError());
    expect(e.code).toBe('cancelled');
  });

  it('uses fallback message for undefined message', () => {
    const e = mapAnthropicError({ status: 500, message: undefined });
    expect(e.message).toBe('Anthropic API error');
  });

  it('passes through plain Error message', () => {
    const e = mapAnthropicError(new Error('custom'));
    expect(e.code).toBe('unknown');
    expect(e.message).toBe('custom');
  });
});
