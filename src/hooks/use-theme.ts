import { useState, useEffect, useCallback } from 'react';

type Theme = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'ai-prompt-manager-theme';
const THEME_CHANGE_EVENT = 'ai-prompt-manager-theme-changed';

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem(STORAGE_KEY) as Theme) || 'system';
}

function applyDOMTheme(theme: Theme) {
  const resolved = theme === 'system' ? getSystemTheme() : theme;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
}

export function useTheme() {
  const [stored, setStored] = useState<Theme>(getStoredTheme);
  const [resolved, setResolved] = useState<'light' | 'dark'>(
    () => getStoredTheme() === 'system' ? getSystemTheme() : getStoredTheme() as 'light' | 'dark'
  );

  // Listen for theme changes from other useTheme instances
  useEffect(() => {
    const sync = () => {
      const s = getStoredTheme();
      setStored(s);
      setResolved(s === 'system' ? getSystemTheme() : s);
    };

    window.addEventListener(THEME_CHANGE_EVENT, sync);

    // Also listen for cross-tab localStorage changes
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) sync();
    };
    window.addEventListener('storage', onStorage);

    // Listen for system theme changes
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemChange = () => {
      if (getStoredTheme() === 'system') sync();
    };
    mql.addEventListener('change', onSystemChange);

    return () => {
      window.removeEventListener(THEME_CHANGE_EVENT, sync);
      window.removeEventListener('storage', onStorage);
      mql.removeEventListener('change', onSystemChange);
    };
  }, []);

  const setTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem(STORAGE_KEY, newTheme);
    applyDOMTheme(newTheme);
    window.dispatchEvent(new CustomEvent(THEME_CHANGE_EVENT));
  }, []);

  const toggleTheme = useCallback(() => {
    const current = getStoredTheme() === 'system' ? getSystemTheme() : getStoredTheme();
    setTheme(current === 'dark' ? 'light' : 'dark');
  }, [setTheme]);

  // Keep DOM in sync on mount
  useEffect(() => {
    applyDOMTheme(stored);
  }, [stored]);

  return { theme: stored, setTheme, toggleTheme, resolvedTheme: resolved };
}
