import { useEffect } from 'react';

interface ShortcutMap {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = [
        e.ctrlKey || e.metaKey ? 'Ctrl' : '',
        e.shiftKey ? 'Shift' : '',
        (e.key || '').toUpperCase(),
      ]
        .filter(Boolean)
        .join('+');

      const action = shortcuts[key];
      if (action) {
        e.preventDefault();
        action();
      }

      // Escape
      if (e.key === 'Escape' && shortcuts['Escape']) {
        shortcuts['Escape']();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
