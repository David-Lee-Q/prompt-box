import { useEffect, useRef } from 'react';

interface ShortcutMap {
  [key: string]: () => void;
}

export function useKeyboardShortcuts(shortcuts: ShortcutMap) {
  const shortcutsRef = useRef(shortcuts);

  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = [
        e.ctrlKey || e.metaKey ? 'Ctrl' : '',
        e.shiftKey ? 'Shift' : '',
        (e.key || '').toUpperCase(),
      ]
        .filter(Boolean)
        .join('+');

      const current = shortcutsRef.current;
      const action = current[key];
      if (action) {
        e.preventDefault();
        action();
        return;
      }

      if (e.key === 'Escape' && current['Escape']) {
        current['Escape']();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // register once — read latest shortcuts via ref
}
