import type { ExportData } from '@/types';

const TOKEN_KEY = 'ai-prompt-manager-cloud-token';
const USERNAME_KEY = 'ai-prompt-manager-cloud-username';
const LAST_SYNC_KEY = 'ai-prompt-manager-cloud-last-sync';

export class SyncApiError extends Error {
  status: number;
  serverUpdatedAt?: number;
  constructor(message: string, status: number, serverUpdatedAt?: number) {
    super(message);
    this.name = 'SyncApiError';
    this.status = status;
    this.serverUpdatedAt = serverUpdatedAt;
  }
}

export interface CloudStatus {
  username: string;
  hasData: boolean;
  updatedAt: number | null;
  promptCount: number;
  versionCount: number;
}

export interface PullResult {
  payload: ExportData;
  updatedAt: number;
  version: number;
}

export function getCloudToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getCloudUsername(): string | null {
  return localStorage.getItem(USERNAME_KEY);
}

export function setCloudSession(token: string, username: string) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USERNAME_KEY, username);
}

export function clearCloudSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
}

export function getLastSyncedAt(): number | null {
  const raw = localStorage.getItem(LAST_SYNC_KEY);
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function setLastSyncedAt(ts: number) {
  localStorage.setItem(LAST_SYNC_KEY, String(ts));
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const token = getCloudToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`/api/sync${path}`, { ...init, headers });
  } catch {
    throw new SyncApiError('无法连接云端服务，请刷新页面后重试', 0);
  }

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    serverUpdatedAt?: number;
  } & T;

  if (!res.ok) {
    throw new SyncApiError(
      body.error || `请求失败（${res.status}）`,
      res.status,
      body.serverUpdatedAt
    );
  }
  return body;
}

export function cloudRegister(username: string, password: string) {
  return request<{ token: string; username: string }>('/register', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function cloudLogin(username: string, password: string) {
  return request<{ token: string; username: string }>('/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}

export function cloudStatus() {
  return request<CloudStatus>('/status');
}

export function cloudPull() {
  return request<PullResult>('/pull');
}

export function cloudPush(payload: ExportData, baseUpdatedAt: number | null, force = false) {
  return request<{ updatedAt: number; version: number }>('/push', {
    method: 'POST',
    body: JSON.stringify({ payload, baseUpdatedAt, force }),
  });
}
