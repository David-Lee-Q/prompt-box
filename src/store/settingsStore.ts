import { create } from 'zustand';
import type { AISettings, ProviderConfig } from '@/types/ai';
import { initAI } from '@/services/ai';
import { generateId } from '@/utils/helpers';

const SETTINGS_KEY = 'ai-prompt-manager-ai-settings';

function loadSettings(): AISettings | null {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (!data) return null;
    const parsed = JSON.parse(data);
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
        providers.push({ id, name: 'OpenAI', format: 'openai', apiKey: parsed.openai.apiKey, baseUrl: parsed.openai.baseUrl || '', model: parsed.openai.model || 'gpt-4o' });
      }
      if (parsed.anthropic?.apiKey) {
        const id = generateId();
        providers.push({ id, name: 'Anthropic', format: 'anthropic', apiKey: parsed.anthropic.apiKey, baseUrl: parsed.anthropic.baseUrl || '', model: parsed.anthropic.model || 'claude-sonnet-4-6' });
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

function persistSettings(settings: AISettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch { /* quota exceeded */ }
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

  loadSettings: () => {
    const saved = loadSettings();
    const active = getActiveProvider(saved);
    if (active?.apiKey) {
      initAI({ format: active.format, apiKey: active.apiKey, model: active.model, baseUrl: active.baseUrl || undefined });
    }
    set({ settings: saved, isConfigured: !!(active?.apiKey), activeProvider: active });
  },

  saveSettings: (s: AISettings) => {
    persistSettings(s);
    const active = getActiveProvider(s);
    if (active?.apiKey) {
      initAI({ format: active.format, apiKey: active.apiKey, model: active.model, baseUrl: active.baseUrl || undefined });
    }
    set({ settings: s, isConfigured: !!(active?.apiKey), activeProvider: active });
  },

  addProvider: (p: ProviderConfig) => {
    const s = get().settings ?? { providers: [], activeProviderId: null };
    const next: AISettings = {
      providers: [...s.providers, p],
      activeProviderId: s.activeProviderId ?? p.id,
    };
    persistSettings(next);
    if (!s.activeProviderId && p.apiKey) {
      initAI({ format: p.format, apiKey: p.apiKey, model: p.model, baseUrl: p.baseUrl || undefined });
    }
    set({ settings: next, isConfigured: true, activeProvider: p });
  },

  updateProvider: (id: string, partial: Partial<ProviderConfig>) => {
    const s = get().settings;
    if (!s) return;
    const next: AISettings = {
      ...s,
      providers: s.providers.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    };
    persistSettings(next);
    const active = getActiveProvider(next);
    if (active?.apiKey) {
      initAI({ format: active.format, apiKey: active.apiKey, model: active.model, baseUrl: active.baseUrl || undefined });
    }
    set({ settings: next, isConfigured: !!(active?.apiKey), activeProvider: active });
  },

  removeProvider: (id: string) => {
    const s = get().settings;
    if (!s) return;
    const providers = s.providers.filter((p) => p.id !== id);
    const next: AISettings = {
      providers,
      activeProviderId: s.activeProviderId === id ? (providers[0]?.id ?? null) : s.activeProviderId,
    };
    persistSettings(next);
    const active = getActiveProvider(next);
    if (active?.apiKey) {
      initAI({ format: active.format, apiKey: active.apiKey, model: active.model, baseUrl: active.baseUrl || undefined });
    } else {
      set({ isConfigured: false, activeProvider: null });
    }
    set({ settings: next, activeProvider: active });
  },

  setActiveProvider: (id: string) => {
    const s = get().settings;
    if (!s) return;
    const next = { ...s, activeProviderId: id };
    persistSettings(next);
    const active = s.providers.find((p) => p.id === id);
    if (active?.apiKey) {
      initAI({ format: active.format, apiKey: active.apiKey, model: active.model, baseUrl: active.baseUrl || undefined });
    }
    set({ settings: next, isConfigured: !!(active?.apiKey), activeProvider: active ?? null });
  },

  clearSettings: () => {
    try { localStorage.removeItem(SETTINGS_KEY); } catch { /* ignore */ }
    set({ settings: null, isConfigured: false, activeProvider: null });
  },

  setShowSettings: (v: boolean) => set({ showSettings: v }),
}));

export default useSettingsStore;
