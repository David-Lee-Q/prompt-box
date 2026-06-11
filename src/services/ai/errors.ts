export type AIErrorCode = 'auth' | 'rate_limit' | 'timeout' | 'network' | 'server' | 'unknown';

export class AIError extends Error {
  constructor(
    message: string,
    public code: AIErrorCode,
    public statusCode?: number,
    public providerRaw?: unknown
  ) {
    super(message);
    this.name = 'AIError';
  }
}
