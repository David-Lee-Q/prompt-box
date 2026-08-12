import { create } from 'zustand';
import { db } from '@/db';
import type { User } from '@/types';
import useSecretStore from './secretStore';
import useSettingsStore from './settingsStore';

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
      if (!user) {
        set({ isLoading: false });
        return '用户名或密码错误';
      }
      const hash = await hashPassword(password, user.salt);
      if (hash !== user.passwordHash) {
        set({ isLoading: false });
        return '用户名或密码错误';
      }
      const sessionUser = { id: user.id, username: user.username, createdAt: user.createdAt };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
      await useSecretStore.getState().unlock(password, user.salt);
      await useSettingsStore.getState().loadSettings();
      set({ currentUser: sessionUser, isAuthenticated: true, isLoading: false });
      return null;
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
