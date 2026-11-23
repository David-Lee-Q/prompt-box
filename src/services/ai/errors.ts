export type AIErrorCode = 'auth' | 'rate_limit' | 'timeout' | 'cancelled' | 'network' | 'server' | 'unknown';

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

const HTML_RESPONSE_PATTERN = /<\s*(!doctype|html|head|body|center)\b|<h1[\s>]/i;

// 部分网关/代理故障时返回 HTML 错误页（如 nginx 50x），SDK 会把原文塞进 error.message，
// 直接展示给用户就是一堆 HTML，这里统一清洗成可读提示
export function sanitizeAiErrorMessage(message: string | undefined, statusCode?: number): string {
  const raw = (message ?? '').trim();
  if (!raw) {
    return statusCode !== undefined
      ? `服务器错误（HTTP ${statusCode}），请稍后重试或检查 API 地址`
      : '请求失败';
  }
  if (HTML_RESPONSE_PATTERN.test(raw) || raw.length > 200) {
    return statusCode !== undefined
      ? `服务器返回异常响应（HTTP ${statusCode}），请检查 API 地址是否正确、服务是否可用`
      : '服务器返回异常响应，请检查 API 地址是否正确';
  }
  return raw;
}
