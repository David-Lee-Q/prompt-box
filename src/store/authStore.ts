import { create } from 'zustand';
import { db } from '@/db';
import type { User } from '@/types';
import useSecretStore from './secretStore';
import useSettingsStore from './settingsStore';
import {
  cloudLogin,
  cloudPull,
  cloudRegister,
  setCloudSession,
  clearCloudSession,
  SyncApiError,
} from '@/services/syncService';
import { importData } from '@/utils/export-import';

const SESSION_KEY = 'ai-prompt-manager-session';

async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations: 600000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateId(): string {
  return crypto.randomUUID();
}

interface AuthStore {
  currentUser: Omit<User, 'passwordHash' | 'salt'> | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  register: (username: string, password: string) => Promise<string | null>;
  logout: () => void;
  checkSession: () => void;
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function getSessionUser(): Omit<User, 'passwordHash' | 'salt'> | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    clearSession();
    return null;
  }
}

const useAuthStore = create<AuthStore>((set) => ({
  currentUser: getSessionUser(),
  isAuthenticated: !!getSessionUser(),
  isLoading: false,

  login: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      const user = await db.users.where('username').equals(username).first();
      if (user) {
        const hash = await hashPassword(password, user.salt);
        if (hash === user.passwordHash) {
          const sessionUser = { id: user.id, username: user.username, createdAt: user.createdAt };
          localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
          await useSecretStore.getState().unlock(password, user.salt);
          await useSettingsStore.getState().loadSettings();
          set({ currentUser: sessionUser, isAuthenticated: true, isLoading: false });
          return null;
        }
      }

      // 本地账号不匹配时尝试云端账号，支持跨设备登录
      try {
        const cloud = await cloudLogin(username, password);
        setCloudSession(cloud.token, cloud.username);
        const existing = await db.users.where('username').equals(username).first();
        let localUser: User;
        if (existing) {
          // 保留本地记录的盐值，避免该设备上已加密的密钥无法解密
          localUser = existing;
        } else {
          const salt = generateSalt();
          localUser = {
            id: generateId(),
            username,
            passwordHash: await hashPassword(password, salt),
            salt,
            createdAt: Date.now(),
          };
          await db.users.add(localUser);
        }
        const sessionUser = { id: localUser.id, username, createdAt: localUser.createdAt };
        localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
        await useSecretStore.getState().unlock(password, localUser.salt);
        await useSettingsStore.getState().loadSettings();
        set({ currentUser: sessionUser, isAuthenticated: true, isLoading: false });

        // 该账号在此设备尚无数据时，自动从云端恢复
        const localSceneCount = await db.scenes.where('userId').equals(localUser.id).count();
        if (localSceneCount === 0) {
          try {
            const pulled = await cloudPull();
            const payload = pulled.payload;
            if (payload && (payload.scenes.length > 0 || payload.prompts.length > 0)) {
              await importData(JSON.stringify(payload), 'overwrite', localUser.id);
            }
          } catch {
            // 云端拉取失败不阻塞登录，用户可在「数据管理」手动恢复
          }
        }
        return null;
      } catch (err) {
        const e = err as SyncApiError;
        if (e && e.status === 0) {
          return user
            ? '本地账号不匹配，且云端服务暂不可达，请检查网络后重试'
            : '云端服务暂不可达，请检查网络后重试';
        }
        return '用户名或密码错误';
      }
    } catch (err) {
      set({ isLoading: false });
      return '登录失败，请重试';
    }
  },

  register: async (username: string, password: string) => {
    set({ isLoading: true });
    try {
      if (username.length < 2) {
        set({ isLoading: false });
        return '用户名至少需要2个字符';
      }
      if (password.length < 6) {
        set({ isLoading: false });
        return '密码至少需要6个字符';
      }
      const existing = await db.users.where('username').equals(username).first();
      if (existing) {
        set({ isLoading: false });
        return '用户名已存在';
      }

      // 同步在云端创建账号，保证该账号可在任意设备登录
      try {
        const cloud = await cloudRegister(username, password);
        setCloudSession(cloud.token, cloud.username);
      } catch (err) {
        if (err instanceof SyncApiError && err.status === 409) {
          set({ isLoading: false });
          return '该用户名已有云端账号，请直接登录';
        }
        // 云端暂不可用时降级为仅本地注册
      }

      const salt = generateSalt();
      const passwordHash = await hashPassword(password, salt);
      const now = Date.now();
      const user: User = {
        id: generateId(),
        username,
        passwordHash,
        salt,
        createdAt: now,
      };
      await db.users.add(user);
      const sessionUser = { id: user.id, username: user.username, createdAt: user.createdAt };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      await useSecretStore.getState().unlock(password, salt);
      await useSettingsStore.getState().loadSettings();
      set({ currentUser: sessionUser, isAuthenticated: true, isLoading: false });
      return null;
    } catch {
      set({ isLoading: false });
      return '注册失败，请重试';
    }
  },

  logout: () => {
    clearSession();
    clearCloudSession();
    useSecretStore.getState().lock();
    set({ currentUser: null, isAuthenticated: false });
  },

  checkSession: () => {
    const user = getSessionUser();
    useSecretStore.getState().lock();
    set({ currentUser: user, isAuthenticated: !!user, isLoading: false });
  },
}));

export default useAuthStore;
