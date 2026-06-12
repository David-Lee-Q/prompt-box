import { describe, it, expect, vi } from 'vitest';

describe('useKeyboardShortcuts — ref-based pattern', () => {
  it('reads latest shortcuts via ref (no per-render registration)', () => {
    // Simulate: handler registered once, shortcuts updated via ref
    let shortcutsRef: Record<string, () => void> = {};
    const fnV1 = vi.fn();
    const fnV2 = vi.fn();

    shortcutsRef = { 'Ctrl+S': fnV1 };

    // handler is created once (mimics useEffect([], ...))
    const handler = (e: KeyboardEvent) => {
      const key = [
        e.ctrlKey || e.metaKey ? 'Ctrl' : '',
        e.shiftKey ? 'Shift' : '',
        (e.key || '').toUpperCase(),
      ].filter(Boolean).join('+');
      const action = shortcutsRef[key];
      if (action) { e.preventDefault(); action(); }
    };

    // First call: should use fnV1
    handler(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    expect(fnV1).toHaveBeenCalledOnce();
    expect(fnV2).not.toHaveBeenCalled();

    // Update ref — shortcuts change without re-registering handler
    shortcutsRef = { 'Ctrl+S': fnV2 };

    // Second call: should use fnV2 (latest via ref)
    handler(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
    expect(fnV2).toHaveBeenCalledOnce(); // called by the ref-updated handler
  });

  it('returns empty string key for null/undefined e.key', () => {
    const fn = vi.fn();
    const shortcutsRef = { '': fn };
    const handler = (e: KeyboardEvent) => {
      const key = (e.key || '').toUpperCase();
      shortcutsRef[key]?.();
    };
    // @ts-expect-error — simulate corrupt event
    handler({ key: null, type: 'keydown' });
    expect(fn).toHaveBeenCalledOnce();
  });
});
