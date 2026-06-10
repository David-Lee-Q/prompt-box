import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// ⚠️  SDK 脆弱性说明
// `@anthropic-ai/sdk` 内部混有 Node 专用代码（node:crypto, node:fs/promises 等）。
// 当前通过三个配置协同规避：optimizeDeps.exclude / build.external / 直接依赖 standardwebhooks。
// 升级 @anthropic-ai/sdk 版本后，必须重新验证 dev server 和 production build 均无报错。

function apiProxyPlugin() {
  return {
    name: 'api-proxy',
    configureServer(server: any) {
      const proxyHandler = (req: any, res: any, next: any) => {
        if (!req.url?.startsWith('/api/proxy')) { next(); return; }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        const targetUrl = req.headers['x-proxy-target'] as string;
        if (!targetUrl) {
          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Missing X-Proxy-Target header' }));
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', async () => {
          const body = Buffer.concat(chunks).toString();
          const fwdHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers)) {
            if (k.startsWith('x-proxy-') || k === 'host' || k === 'origin' || k === 'referer' || k === 'cookie') continue;
            if (typeof v === 'string') fwdHeaders[k] = v;
          }
          console.log(`[api-proxy] → ${targetUrl}  body=${body.length}B`);
          try {
            const fetchRes = await fetch(targetUrl, {
              method: 'POST',
              headers: fwdHeaders,
              body,
              signal: AbortSignal.timeout(300000),
            });
            res.statusCode = fetchRes.status;
            for (const [k, v] of fetchRes.headers.entries()) {
              // Node fetch auto-decompresses — strip upstream content-encoding
              // to prevent browser from double-decompressing.
              if (k === 'content-encoding') continue;
              res.setHeader(k, v);
            }

            // Stream the response body chunk-by-chunk so the browser
            // gets data immediately (critical for SSE streaming APIs).
            if (fetchRes.body) {
              const reader = fetchRes.body.getReader();
              let totalBytes = 0;
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  totalBytes += value.byteLength;
                  if (!res.write(value)) {
                    // Backpressure — wait for drain before reading more
                    await new Promise((r) => res.once('drain', r));
                  }
                }
                console.log(`[api-proxy] ← ${fetchRes.status}  streamed=${totalBytes}B`);
              } catch (streamErr) {
                console.error(`[api-proxy] stream error after ${totalBytes}B: ${String(streamErr)}`);
              }
              if (!res.writableEnded) res.end();
            } else {
              console.log(`[api-proxy] ← ${fetchRes.status}  body=empty`);
              res.end();
            }
          } catch (err) {
            console.error(`[api-proxy] ✗ ${targetUrl} — ${String(err)}`);
            res.statusCode = 502;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Proxy unreachable', target: targetUrl, detail: String(err) }));
          }
        });
      };

      server.middlewares.use(proxyHandler);

      // Vite adds its SPA fallback AFTER configureServer.
      // Move our handler to index 0 to beat any catch-alls.
      const stack = server.middlewares.stack as any[];
      const ourIdx = stack.findIndex((s: any) => s.handle === proxyHandler);
      if (ourIdx >= 0) {
        const [entry] = stack.splice(ourIdx, 1);
        stack.unshift(entry);
      }
    },
  };
}

export default defineConfig({
  plugins: [apiProxyPlugin(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['@codemirror/state', '@codemirror/view'],
  },
  define: {
    global: 'globalThis',
  },
  optimizeDeps: {
    exclude: ['@anthropic-ai/sdk'],
    include: ['standardwebhooks'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    rollupOptions: {
      external: [/^node:/],
    },
  },
})
