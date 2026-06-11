import { shouldUseProxy } from '@/utils/env';

const PROXY_FALLBACK = '/api/proxy';

/**
 * Fetch wrapper that routes external URLs through the Vite dev proxy
 * to bypass browser CORS restrictions. In extension environments with
 * host_permissions, direct fetch is used instead.
 */
export function createProxyFetch(): typeof fetch {
  // Extension with host_permissions — direct fetch, no CORS issue
  if (!shouldUseProxy()) {
    return (url, init) => fetch(url, init);
  }

  // Web mode — route through Vite/Cloudflare proxy
  return (url, init) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // Same-origin or relative — no CORS issue, pass through
    if (urlStr.startsWith('/') || urlStr.startsWith(window.location.origin)) {
      return fetch(url, init);
    }

    // External URL — route through proxy to avoid CORS
    const headers = new Headers(init?.headers);
    headers.set('X-Proxy-Target', urlStr);

    const method = init?.method ?? 'POST';
    const body = init?.body;
    const signal = init?.signal;
    console.log(`[fetchWithProxy] → ${urlStr}  method=${method}  body=${typeof body === 'string' ? body.length + 'B' : typeof body}`);

    return fetch(PROXY_FALLBACK, { method, headers, body, signal });
  };
}
