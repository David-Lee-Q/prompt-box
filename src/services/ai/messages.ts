import { AIError } from './errors';

const CODE_MESSAGES: Record<string, string> = {
  auth: 'API Key 无效或已过期，请检查 AI 设置',
  rate_limit: '请求过于频繁，请稍后重试',
  timeout: '请求超时，请检查网络连接',
  network: '网络连接失败，请检查网络或 API 地址',
  server: '服务器错误，请稍后重试或检查 API 地址',
  unknown: '请求失败',
};

export function friendlyErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AIError) {
    return CODE_MESSAGES[err.code] || err.message;
  }
  return err instanceof Error ? err.message : fallback;
}
