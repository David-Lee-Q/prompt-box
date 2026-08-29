import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.SYNC_PORT || 3001);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'sync-data.json');
const MAX_BODY = 50 * 1024 * 1024;

let state = { users: {}, data: {} };

function loadState() {
  try {
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    state = { users: parsed.users || {}, data: parsed.data || {} };
  } catch {
    state = { users: {}, data: {} };
  }
}

function saveState() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state));
  fs.renameSync(tmp, DATA_FILE);
}

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function sendJSON(res, status, body) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
  if (status === 204) {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  const payload = JSON.stringify(body);
  res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf-8');
      req._bodyText = text;
      resolve(text);
    });
    req.on('error', reject);
  });
}

function findUserByToken(req) {
  const header = req.headers['authorization'] || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token) return null;
  for (const record of Object.values(state.users)) {
    if (record.token === token) return record;
  }
  return null;
}

async function handleRegister(req, res) {
  const body = JSON.parse((await readBody(req)) || '{}');
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  if (username.length < 2 || username.length > 32) {
    return sendJSON(res, 400, { error: '用户名长度需为 2-32 个字符' });
  }
  if (password.length < 6) {
    return sendJSON(res, 400, { error: '密码至少需要 6 个字符' });
  }
  if (state.users[username]) {
    return sendJSON(res, 409, { error: '用户名已存在，请直接登录' });
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const record = {
    username,
    salt,
    passwordHash: hashPassword(password, salt),
    token: crypto.randomBytes(32).toString('hex'),
    createdAt: Date.now(),
  };
  state.users[username] = record;
  saveState();
  sendJSON(res, 200, { token: record.token, username });
}

async function handleLogin(req, res) {
  const body = JSON.parse((await readBody(req)) || '{}');
  const username = String(body.username || '').trim();
  const password = String(body.password || '');
  const record = state.users[username];
  if (!record) {
    return sendJSON(res, 401, { error: '用户名或密码错误' });
  }
  const hash = Buffer.from(hashPassword(password, record.salt), 'hex');
  const stored = Buffer.from(record.passwordHash, 'hex');
  const ok = hash.length === stored.length && crypto.timingSafeEqual(hash, stored);
  if (!ok) {
    return sendJSON(res, 401, { error: '用户名或密码错误' });
  }
  sendJSON(res, 200, { token: record.token, username });
}

function handleStatus(res, username) {
  const entry = state.data[username];
  sendJSON(res, 200, {
    username,
    hasData: !!entry,
    updatedAt: entry ? entry.updatedAt : null,
    promptCount: entry?.payload?.prompts?.length ?? 0,
    versionCount: entry?.payload?.versions?.length ?? 0,
  });
}

function handlePull(res, username) {
  const entry = state.data[username];
  if (!entry) {
    return sendJSON(res, 404, { error: '云端暂无数据' });
  }
  sendJSON(res, 200, { payload: entry.payload, updatedAt: entry.updatedAt, version: entry.version });
}

async function handlePush(req, res, username) {
  let body;
  try {
    body = JSON.parse((await readBody(req)) || '{}');
  } catch {
    return sendJSON(res, 400, { error: '请求体格式错误' });
  }
  const { payload, baseUpdatedAt, force } = body;
  if (!payload || !Array.isArray(payload.scenes) || !Array.isArray(payload.prompts) || !Array.isArray(payload.versions)) {
    return sendJSON(res, 400, { error: '数据格式不完整，缺少 scenes/prompts/versions 字段' });
  }
  const entry = state.data[username];
  if (entry && !force && entry.updatedAt !== baseUpdatedAt) {
    return sendJSON(res, 409, { error: '云端数据较新，继续同步将覆盖云端数据', serverUpdatedAt: entry.updatedAt });
  }
  const next = {
    payload,
    version: (entry?.version || 0) + 1,
    updatedAt: Date.now(),
  };
  state.data[username] = next;
  saveState();
  sendJSON(res, 200, { updatedAt: next.updatedAt, version: next.version });
}

async function handleAPI(req, res, pathname) {
  if (req.method === 'GET' && pathname === '/api/sync/health') {
    return sendJSON(res, 200, { ok: true });
  }
  if (req.method === 'POST' && pathname === '/api/sync/register') {
    return handleRegister(req, res);
  }
  if (req.method === 'POST' && pathname === '/api/sync/login') {
    return handleLogin(req, res);
  }

  const user = findUserByToken(req);
  if (!user) {
    return sendJSON(res, 401, { error: '未登录或登录已过期' });
  }
  req._authUser = user;

  if (req.method === 'GET' && pathname === '/api/sync/status') {
    return handleStatus(res, user.username);
  }
  if (req.method === 'GET' && pathname === '/api/sync/pull') {
    return handlePull(res, user.username);
  }
  if (req.method === 'POST' && pathname === '/api/sync/push') {
    return handlePush(req, res, user.username);
  }
  sendJSON(res, 404, { error: 'Not Found' });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const startedAt = Date.now();
  res.on('finish', () => {
    let who = req._authUser ? req._authUser.username : '';
    if (!who && req._bodyText) {
      try {
        who = String(JSON.parse(req._bodyText).username || '');
      } catch {
        who = '';
      }
    }
    console.log(
      `[sync-server] ${new Date().toISOString()} ${req.method} ${url.pathname} -> ${res.statusCode} user=${who || '-'} ${Date.now() - startedAt}ms`,
    );
  });
  if (!url.pathname.startsWith('/api/sync')) {
    return sendJSON(res, 404, { error: 'Not Found' });
  }
  if (req.method === 'OPTIONS') {
    return sendJSON(res, 204);
  }
  try {
    await handleAPI(req, res, url.pathname);
  } catch (err) {
    console.error('[sync-server] error:', err);
    sendJSON(res, 500, { error: '服务器内部错误' });
  }
});

loadState();
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[sync-server] listening on http://127.0.0.1:${PORT}`);
});
