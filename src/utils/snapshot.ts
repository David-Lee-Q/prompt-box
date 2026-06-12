import { db } from '@/db';
import type { ExportData } from '@/types';

const SNAPSHOT_KEY = 'ai-prompt-manager-snapshots';
const MAX_SNAPSHOTS = 3;

interface SnapshotEntry {
  id: string;
  timestamp: number;
  date: string;
  data: ExportData;
}

export async function createSnapshot(): Promise<void> {
  // Lock to prevent concurrent snapshot creation across tabs
  const LOCK_KEY = 'ai-prompt-manager-snapshot-lock';
  const now = Date.now();
  const existingLock = localStorage.getItem(LOCK_KEY);
  if (existingLock && now - Number(existingLock) < 5000) return; // another tab is snapshotting
  localStorage.setItem(LOCK_KEY, String(now));

  try {
    const [scenes, prompts, versions] = await Promise.all([
      db.scenes.toArray(),
      db.prompts.toArray(),
      db.versions.toArray(),
    ]);

    const data: ExportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      scenes,
      prompts,
      versions,
    };

    const snapshots = getSnapshots();
    snapshots.unshift({
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      data,
    });

    // Keep only the latest MAX_SNAPSHOTS
    while (snapshots.length > MAX_SNAPSHOTS) {
      snapshots.pop();
    }

    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshots));
  } catch {
    // Snapshot failures are non-critical
  } finally {
    localStorage.removeItem('ai-prompt-manager-snapshot-lock');
  }
}

export function getSnapshots(): SnapshotEntry[] {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function hasTodaysSnapshot(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return getSnapshots().some((s) => s.date === today);
}
