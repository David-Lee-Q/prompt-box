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
