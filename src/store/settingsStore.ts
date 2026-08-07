import { create } from 'zustand';
import type { AISettings, ProviderConfig } from '@/types/ai';
import { getOrCreateProvider, setCurrentProvider, evictProvider } from '@/services/ai';
import { generateId } from '@/utils/helpers';
import useSecretStore, { encryptSecret, decryptSecret } from './secretStore';

const SETTINGS_KEY = 'ai-prompt-manager-ai-settings';
const ENC_PREFIX = 'enc:v1:';

async function loadSettings(): Promise<AISettings | null> {
  try {
    // chrome.storage.local for extension, fall back to localStorage for web
    let raw: string | null = null;
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      const result = await chrome.storage.local.get(SETTINGS_KEY);
      raw = (result[SETTINGS_KEY] as string) || null;
    }
    if (!raw) {
      raw = localStorage.getItem(SETTINGS_KEY);
    }
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Already multi-provider format
    if (parsed.providers && Array.isArray(parsed.providers)) return parsed;
    // Migrate old single-provider format
    if (parsed.provider || parsed.apiKey || parsed.model) {
      const id = generateId();
      return {
        providers: [{
          id,
          name: parsed.provider || 'Default',
          format: parsed.format || 'openai',
          apiKey: parsed.apiKey || '',
          baseUrl: parsed.baseUrl || '',
          model: parsed.model || '',
        }],
        activeProviderId: id,
      };
    }
    // Migrate old openai/anthropic sub-object format
    if (parsed.openai || parsed.anthropic) {
      const providers: ProviderConfig[] = [];
      if (parsed.openai?.apiKey) {
        const id = generateId();
        providers.push({ id, name: 'OpenAI', format: 'openai', apiKey: parsed.openai.apiKey, baseUrl: parsed.openai.baseUrl || '', model: parsed.openai.model || '' });
      }
      if (parsed.anthropic?.apiKey) {
        const id = generateId();
        providers.push({ id, name: 'Anthropic', format: 'anthropic', apiKey: parsed.anthropic.apiKey, baseUrl: parsed.anthropic.baseUrl || '', model: parsed.anthropic.model || '' });
      }
      if (providers.length > 0) {
        return { providers, activeProviderId: providers[0]!.id };
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function persistSettings(settings: AISettings) {
  try {
    // Built-in model apiKey is encrypted at rest; custom providers stay plaintext.
    // Deep-copy so in-memory state keeps the decrypted plaintext.
    const payload: AISettings = {
      ...settings,
      providers: settings.providers.map((p) => ({ ...p })),
    };
    if (payload.providers.length > 0) {
      const hasKey = !!(await getSecretKey());
      for (const p of payload.providers) {
        if (!needsEncryption(p)) continue;
        if (!hasKey) {
          // No key in memory (not logged in): never persist plaintext — blank it out
          p.apiKey = '';
        } else if (!isEncryptedApiKey(p.apiKey)) {
          p.apiKey = await encryptApiKey(p);
        }
      }
    }
    const json = JSON.stringify(payload);
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      await chrome.storage.local.set({ [SETTINGS_KEY]: json });
    }
    localStorage.setItem(SETTINGS_KEY, json);
  } catch { /* storage unavailable — non-critical */ }
}

/** Decrypt built-in model apiKey into in-memory settings for AI calls. */
async function hydrateSettings(raw: AISettings | null): Promise<AISettings | null> {
  if (!raw) return null;
  const hydrated: AISettings = {
    ...raw,
    providers: await Promise.all(
      raw.providers.map(async (p) => ({
        ...p,
        apiKey: needsEncryption(p) ? await decryptApiKey(p) : p.apiKey,
      }))
    ),
  };
  return hydrated;
}

function getActiveProvider(settings: AISettings | null): ProviderConfig | null {
  if (!settings?.activeProviderId) {
    return settings?.providers?.[0] ?? null;
  }
  return settings.providers.find((p) => p.id === settings.activeProviderId) ?? settings.providers[0] ?? null;
}

async function getSecretKey(): Promise<CryptoKey | null> {
  return useSecretStore.getState().key;
}

function isEncryptedApiKey(value: string): boolean {
  return value.startsWith(ENC_PREFIX);
}

async function encryptApiKey(provider: ProviderConfig): Promise<string> {
  const key = await getSecretKey();
  if (!key) return provider.apiKey;
  if (isEncryptedApiKey(provider.apiKey)) return provider.apiKey;
  const encrypted = await encryptSecret(provider.apiKey, key);
  return ENC_PREFIX + encrypted;
}

async function decryptApiKey(provider: ProviderConfig): Promise<string> {
  const key = await getSecretKey();
  if (!isEncryptedApiKey(provider.apiKey)) return provider.apiKey;
  if (!key) return '';
  try {
    return await decryptSecret(provider.apiKey.slice(ENC_PREFIX.length), key);
  } catch {
    return '';
  }
}

/** 仅加密内置模型的 apiKey（builtIn: true），自定义 provider 保持明文 */
function needsEncryption(provider: ProviderConfig): boolean {
  return !!provider.builtIn;
}

interface SettingsStore {
  settings: AISettings | null;
  showSettings: boolean;
  isConfigured: boolean;
  activeProvider: ProviderConfig | null;

  loadSettings: () => void;
  saveSettings: (s: AISettings) => void;
  addProvider: (p: ProviderConfig) => void;
  updateProvider: (id: string, p: Partial<ProviderConfig>) => void;
  removeProvider: (id: string) => void;
  setActiveProvider: (id: string) => void;
  clearSettings: () => void;
  setShowSettings: (v: boolean) => void;
}

const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: null,
  showSettings: false,
  isConfigured: false,
  activeProvider: null,

  loadSettings: async () => {
    const saved = await loadSettings();
    const hydrated = await hydrateSettings(saved);
    const active = getActiveProvider(hydrated);
    if (active?.apiKey) {
      // Evict stale cached provider so the decrypted key takes effect
      evictProvider(active.id);
      setCurrentProvider(getOrCreateProvider(active), active.id);
    }
    set({ settings: hydrated, isConfigured: !!(active?.apiKey), activeProvider: active });
  },

  saveSettings: async (s: AISettings) => {
    const hydrated = (await hydrateSettings(s)) ?? s;
    await persistSettings(hydrated);
    const active = getActiveProvider(hydrated);
    if (active?.apiKey) {
      const prev = get().activeProvider;
      if (prev && prev.id === active.id) {
        evictProvider(active.id);
      }
      setCurrentProvider(getOrCreateProvider(active), active.id);
    }
    set({ settings: hydrated, isConfigured: !!(active?.apiKey), activeProvider: active });
  },

  addProvider: async (p: ProviderConfig) => {
    const s = get().settings ?? { providers: [], activeProviderId: null };
    const next: AISettings = {
      providers: [...s.providers, p],
      activeProviderId: s.activeProviderId ?? p.id,
    };
    await persistSettings(next);
    const hydrated = await hydrateSettings(next);
    const active = getActiveProvider(hydrated);
    if (!s.activeProviderId && p.apiKey) {
      setCurrentProvider(getOrCreateProvider(p), p.id);
    }
    set({ settings: hydrated, isConfigured: !!(active?.apiKey), activeProvider: active });
  },

  updateProvider: async (id: string, partial: Partial<ProviderConfig>) => {
    const s = get().settings;
    if (!s) return;
    const next: AISettings = {
      ...s,
      providers: s.providers.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    };
    await persistSettings(next);
    const hydrated = await hydrateSettings(next);
    evictProvider(id);
    const active = getActiveProvider(hydrated);
    if (active?.apiKey) {
      setCurrentProvider(getOrCreateProvider(active), active.id);
    }
    set({ settings: hydrated, isConfigured: !!(active?.apiKey), activeProvider: active });
  },

  removeProvider: async (id: string) => {
    const s = get().settings;
    if (!s) return;
    const providers = s.providers.filter((p) => p.id !== id);
    const next: AISettings = {
      providers,
      activeProviderId: s.activeProviderId === id ? (providers[0]?.id ?? null) : s.activeProviderId,
    };
    await persistSettings(next);
    evictProvider(id);
    const hydrated = await hydrateSettings(next);
    const active = getActiveProvider(hydrated);
    if (active?.apiKey) {
      setCurrentProvider(getOrCreateProvider(active), active.id);
    } else {
      set({ isConfigured: false, activeProvider: null });
    }
    set({ settings: hydrated, activeProvider: active });
  },

  setActiveProvider: async (id: string) => {
    const s = get().settings;
    if (!s) return;
    const next = { ...s, activeProviderId: id };
    await persistSettings(next);
    const hydrated = await hydrateSettings(next);
    const active = getActiveProvider(hydrated);
    if (active?.apiKey) {
      setCurrentProvider(getOrCreateProvider(active), active.id);
    }
    set({ settings: hydrated, isConfigured: !!(active?.apiKey), activeProvider: active ?? null });
  },

  clearSettings: async () => {
    try {
      if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        await chrome.storage.local.remove(SETTINGS_KEY);
      }
      localStorage.removeItem(SETTINGS_KEY);
    } catch { /* ignore */ }
    set({ settings: null, isConfigured: false, activeProvider: null });
  },

  setShowSettings: (v: boolean) => set({ showSettings: v }),
}));

// Cross-tab sync: reload settings when another tab changes them
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === SETTINGS_KEY && e.newValue) {
      useSettingsStore.getState().loadSettings();
    }
  });
}

export default useSettingsStore;
