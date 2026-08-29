import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const backend = spawn(process.execPath, [path.join(root, 'server/index.mjs')], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});

const vite = spawn(path.join(root, 'node_modules/vite/bin/vite.js'), [], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});

let exiting = false;
function shutdown(code) {
  if (exiting) return;
  exiting = true;
  for (const child of [backend, vite]) {
    if (child.exitCode === null) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500).unref();
}

backend.on('exit', (code) => shutdown(code ?? 1));
vite.on('exit', (code) => shutdown(code ?? 0));
process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
