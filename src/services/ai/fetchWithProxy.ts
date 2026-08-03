import { shouldUseProxy } from '@/utils/env';

const PROXY_FALLBACK = '/api/proxy';

export function createProxyFetch(): typeof fetch {
  if (!shouldUseProxy()) {
    return (url, init) => fetch(url, init);
  }

  return async (url, init) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    if (urlStr.startsWith('/') || urlStr.startsWith(window.location.origin)) {
      return fetch(url, init);
    }

    try {
      return await fetch(urlStr, init);
    } catch {
      const headers = new Headers(init?.headers);
      headers.set('X-Proxy-Target', urlStr);
      const method = init?.method ?? 'POST';
      return fetch(PROXY_FALLBACK, { method, headers, body: init?.body, signal: init?.signal });
    }
  };
}
