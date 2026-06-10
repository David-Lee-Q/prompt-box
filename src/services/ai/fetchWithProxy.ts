const PROXY_FALLBACK = '/api/proxy';

/**
 * Fetch wrapper that routes external URLs through the Vite dev proxy
 * to bypass browser CORS restrictions. Same-origin and relative URLs
 * pass through directly.
 */
export function createProxyFetch(): typeof fetch {
  return (url, init) => {
    const urlStr = typeof url === 'string' ? url : url.toString();

    // Same-origin or relative — no CORS issue, pass through
    if (urlStr.startsWith('/') || urlStr.startsWith(window.location.origin)) {
      return fetch(url, init);
    }

    // External URL — route through Vite proxy to avoid CORS
    const headers = new Headers(init?.headers);
    headers.set('X-Proxy-Target', urlStr);

    const method = init?.method ?? 'POST';
    const body = init?.body;
    const signal = init?.signal;
    console.log(`[fetchWithProxy] → ${urlStr}  method=${method}  body=${typeof body === 'string' ? body.length + 'B' : typeof body}`);

    return fetch(PROXY_FALLBACK, { method, headers, body, signal });
  };
}
