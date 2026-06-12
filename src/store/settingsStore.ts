import { create } from 'zustand';
import type { AISettings, ProviderConfig } from '@/types/ai';
import { getOrCreateProvider, setCurrentProvider, evictProvider } from '@/services/ai';
import { generateId } from '@/utils/helpers';

const SETTINGS_KEY = 'ai-prompt-manager-ai-settings';

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
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
      await chrome.storage.local.set({ [SETTINGS_KEY]: JSON.stringify(settings) });
    }
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* storage unavailable — non-critical */ }
}

function getActiveProvider(settings: AISettings | null): ProviderConfig | null {
  if (!settings?.activeProviderId) {
    return settings?.providers?.[0] ?? null;
  }
  return settings.providers.find((p) => p.id === settings.activeProviderId) ?? settings.providers[0] ?? null;
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
    const active = getActiveProvider(saved);
    if (active?.apiKey) {
      setCurrentProvider(getOrCreateProvider(active), active.id);
    }
    set({ settings: saved, isConfigured: !!(active?.apiKey), activeProvider: active });
  },

  saveSettings: async (s: AISettings) => {
    await persistSettings(s);
    const active = getActiveProvider(s);
    if (active?.apiKey) {
      const prev = get().activeProvider;
      if (prev && prev.id === active.id) {
        evictProvider(active.id);
      }
      setCurrentProvider(getOrCreateProvider(active), active.id);
    }
    set({ settings: s, isConfigured: !!(active?.apiKey), activeProvider: active });
  },

  addProvider: async (p: ProviderConfig) => {
    const s = get().settings ?? { providers: [], activeProviderId: null };
    const next: AISettings = {
      providers: [...s.providers, p],
      activeProviderId: s.activeProviderId ?? p.id,
    };
    await persistSettings(next);
    if (!s.activeProviderId && p.apiKey) {
      setCurrentProvider(getOrCreateProvider(p), p.id);
    }
    set({ settings: next, isConfigured: true, activeProvider: p });
  },

  updateProvider: async (id: string, partial: Partial<ProviderConfig>) => {
    const s = get().settings;
    if (!s) return;
    const next: AISettings = {
      ...s,
      providers: s.providers.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    };
    await persistSettings(next);
    evictProvider(id);
    const active = getActiveProvider(next);
    if (active?.apiKey) {
      setCurrentProvider(getOrCreateProvider(active), active.id);
    }
    set({ settings: next, isConfigured: !!(active?.apiKey), activeProvider: active });
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
    const active = getActiveProvider(next);
    if (active?.apiKey) {
      setCurrentProvider(getOrCreateProvider(active), active.id);
    } else {
      set({ isConfigured: false, activeProvider: null });
    }
    set({ settings: next, activeProvider: active });
  },

  setActiveProvider: async (id: string) => {
    const s = get().settings;
    if (!s) return;
    const next = { ...s, activeProviderId: id };
    await persistSettings(next);
    const active = s.providers.find((p) => p.id === id);
    if (active?.apiKey) {
      setCurrentProvider(getOrCreateProvider(active), active.id);
    }
    set({ settings: next, isConfigured: !!(active?.apiKey), activeProvider: active ?? null });
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
