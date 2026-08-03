import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

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
          try {
            const fetchRes = await fetch(targetUrl, {
              method: 'POST',
              headers: fwdHeaders,
              body,
              signal: AbortSignal.timeout(300000),
            });
            res.statusCode = fetchRes.status;
            for (const [k, v] of fetchRes.headers.entries()) {
              if (k === 'content-encoding') continue;
              res.setHeader(k, v);
            }

            if (fetchRes.body) {
              const reader = fetchRes.body.getReader();
              let totalBytes = 0;
              try {
                while (true) {
                  const { done, value } = await reader.read();
                  if (done) break;
                  totalBytes += value.byteLength;
                  if (!res.write(value)) {
                    await new Promise((r) => res.once('drain', r));
                  }
                }
              } catch (streamErr) {
                console.error(`[api-proxy] stream error after ${totalBytes}B: ${String(streamErr)}`);
              }
              if (!res.writableEnded) res.end();
            } else {
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

      const stack = server.middlewares.stack as any[];
      const ourIdx = stack.findIndex((s: any) => s.handle === proxyHandler);
      if (ourIdx >= 0) {
        const [entry] = stack.splice(ourIdx, 1);
        stack.unshift(entry);
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const isExtension = mode === 'extension';

  return {
    plugins: [
      react(),
      ...(!isExtension ? [apiProxyPlugin()] : []),
    ],
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: ['.cosmoplat.cn'],
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
      dedupe: ['@codemirror/state', '@codemirror/view'],
    },
    define: {
      global: 'globalThis',
      __APP_VERSION__: JSON.stringify(pkg.version),
      ...(isExtension ? { 'import.meta.env.VITE_IS_EXTENSION': JSON.stringify('true') } : {}),
    },
    publicDir: isExtension ? 'public-ext' : 'public',
    build: {
      outDir: isExtension ? 'dist-ext' : 'dist',
      rollupOptions: {
        ...(isExtension ? {
          input: {
            sidepanel: path.resolve(__dirname, 'side_panel.html'),
            options: path.resolve(__dirname, 'options.html'),
          },
        } : {}),
        external: [/^node:/],
      },
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
  };
})
