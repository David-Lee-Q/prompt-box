import { create } from 'zustand';
import type { Scene, Prompt, Version } from '@/types';
import { getScenes } from '@/services/sceneService';
import { getAllPrompts, getPromptsByScene, getStarredPrompts, searchPrompts } from '@/services/promptService';

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
  storageInfo: { used: number; quota: number | null };
  searchHistory: string[];

  loadAll: () => Promise<void>;
  loadPrompts: () => Promise<void>;
  setActiveScene: (id: string | null) => void;
  setActivePrompt: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
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
  storageInfo: { used: 0, quota: null },
  searchHistory: loadSearchHistory(),

  loadAll: async () => {
    set({ isLoading: true });
    try {
      const scenes = await getScenes();
      set({ scenes, isLoading: false });
      await get().refreshStorageInfo();
    } catch {
      set({ isLoading: false });
    }
  },

  loadPrompts: async () => {
    const { activeSceneId, searchQuery, isStarredFilter, filterTag, dateRange } = get();

    let results: Prompt[];

    if (searchQuery) {
      results = await searchPrompts(searchQuery);
    } else if (isStarredFilter) {
      results = await getStarredPrompts();
    } else if (activeSceneId) {
      results = await getPromptsByScene(activeSceneId);
    } else {
      results = await getAllPrompts();
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

export default useAppStore;
