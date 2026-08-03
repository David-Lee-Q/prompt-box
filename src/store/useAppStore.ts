import { create } from 'zustand';
import type { Scene, Prompt, Version } from '@/types';
import { getScenes } from '@/services/sceneService';
import { getAllPrompts, getPromptsByScene, getStarredPrompts, searchPrompts } from '@/services/promptService';
import { migrateLegacyData } from '@/db';
import { getSessionUser } from '@/store/authStore';

interface AppStore {
  scenes: Scene[];
  activeSceneId: string | null;
  prompts: Prompt[];
  activePromptId: string | null;
  versions: Version[];
  searchQuery: string;
  isStarredFilter: boolean;
  filterTag: string | null;
  dateRange: { from: number | null; to: number | null };
  isLoading: boolean;
  loadError: string | null;
  viewMode: 'card' | 'table';
  storageInfo: { used: number; quota: number | null };
  searchHistory: string[];

  loadAll: () => Promise<void>;
  loadPrompts: () => Promise<void>;
  setActiveScene: (id: string | null) => void;
  setActivePrompt: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: 'card' | 'table') => void;
  toggleStarredFilter: () => void;
  setFilterTag: (tag: string | null) => void;
  setDateRange: (range: { from: number | null; to: number | null }) => void;
  setScenes: (scenes: Scene[]) => void;
  setPrompts: (prompts: Prompt[]) => void;
  setVersions: (versions: Version[]) => void;
  refreshStorageInfo: () => Promise<void>;
  addSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
}

function loadSearchHistory(): string[] {
  try {
    const data = localStorage.getItem('search-history');
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

const useAppStore = create<AppStore>((set, get) => ({
  scenes: [],
  activeSceneId: null,
  prompts: [],
  activePromptId: null,
  versions: [],
  searchQuery: '',
  isStarredFilter: false,
  filterTag: null,
  dateRange: { from: null, to: null },
  isLoading: false,
  loadError: null,
  viewMode: (localStorage.getItem('ai-prompt-manager-view-mode') as 'card' | 'table') || 'card',
  storageInfo: { used: 0, quota: null },
  searchHistory: loadSearchHistory(),

  loadAll: async () => {
    set({ isLoading: true, loadError: null });
    try {
      const user = getSessionUser();
      if (user) {
        await migrateLegacyData(user.id);
        const scenes = await getScenes(user.id);
        set({ scenes, isLoading: false });
      } else {
        set({ scenes: [], isLoading: false });
      }
      await get().refreshStorageInfo();
    } catch {
      set({ isLoading: false, loadError: '数据加载失败，请刷新页面重试' });
    }
  },

  loadPrompts: async () => {
    const { activeSceneId, searchQuery, isStarredFilter, filterTag, dateRange } = get();
    const user = getSessionUser();
    if (!user) {
      set({ prompts: [] });
      return;
    }

    let results: Prompt[];

    if (searchQuery) {
      results = await searchPrompts(searchQuery, user.id);
    } else if (isStarredFilter) {
      results = await getStarredPrompts(user.id);
    } else if (activeSceneId) {
      results = await getPromptsByScene(activeSceneId, user.id);
    } else {
      results = await getAllPrompts(user.id);
    }

    // Apply tag filter in memory
    if (filterTag) {
      results = results.filter((p) => p.tags.includes(filterTag!));
    }

    // Apply date range filter in memory
    if (dateRange.from) {
      results = results.filter((p) => p.createdAt >= dateRange.from!);
    }
    if (dateRange.to) {
      results = results.filter((p) => p.createdAt <= dateRange.to!);
    }

    // Default sort (non-search queries may return unsorted)
    results.sort((a, b) => b.updatedAt - a.updatedAt);

    set({ prompts: results });
  },

  setActiveScene: (id) => {
    set({ activeSceneId: id, activePromptId: null });
  },

  setActivePrompt: (id) => {
    set({ activePromptId: id });
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
  },

  setViewMode: (mode) => {
    localStorage.setItem('ai-prompt-manager-view-mode', mode);
    set({ viewMode: mode });
  },

  toggleStarredFilter: () => {
    set((state) => ({ isStarredFilter: !state.isStarredFilter }));
  },

  setFilterTag: (tag) => {
    set({ filterTag: tag });
  },

  setDateRange: (range) => {
    set({ dateRange: range });
  },

  setScenes: (scenes) => set({ scenes }),
  setPrompts: (prompts) => set({ prompts }),
  setVersions: (versions) => set({ versions }),

  refreshStorageInfo: async () => {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const estimate = await navigator.storage.estimate();
        set({
          storageInfo: {
            used: estimate.usage ?? 0,
            quota: estimate.quota ?? null,
          },
        });
      }
    } catch {
      // storage estimate not available
    }
  },

  addSearchHistory: (query) => {
    set((state) => {
      const history = [query, ...state.searchHistory.filter((h) => h !== query)].slice(0, 10);
      localStorage.setItem('search-history', JSON.stringify(history));
      return { searchHistory: history };
    });
  },

  clearSearchHistory: () => {
    localStorage.removeItem('search-history');
    set({ searchHistory: [] });
  },
}));

// Cross-tab sync: reload data when tab becomes visible (other tab may have changed it)
if (typeof document !== 'undefined') {
  let cleanup = false;
  const handler = () => {
    if (cleanup) return;
    if (document.visibilityState === 'visible') {
      const store = useAppStore.getState();
      store.loadAll().catch(() => {}).then(() => store.loadPrompts().catch(() => {}));
    }
  };
  document.addEventListener('visibilitychange', handler);
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      cleanup = true;
      document.removeEventListener('visibilitychange', handler);
    });
  }
}
export default useAppStore;
