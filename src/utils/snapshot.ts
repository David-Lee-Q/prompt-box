import { db, type SnapshotEntry } from '@/db';
import type { ExportData } from '@/types';
import { PUBLIC_USER_ID } from '@/constants';

const MAX_SNAPSHOTS = 3;

export async function createSnapshot(userId?: string): Promise<void> {
  // Lock to prevent concurrent snapshot creation across tabs
  const LOCK_KEY = 'ai-prompt-manager-snapshot-lock';
  const now = Date.now();
  const existingLock = localStorage.getItem(LOCK_KEY);
  if (existingLock && now - Number(existingLock) < 5000) return;
  localStorage.setItem(LOCK_KEY, String(now));

  try {
    const [scenes, prompts, versions] = await Promise.all([
      userId ? db.scenes.where('userId').anyOf([userId, PUBLIC_USER_ID]).toArray() : db.scenes.toArray(),
      userId ? db.prompts.where('userId').anyOf([userId, PUBLIC_USER_ID]).toArray() : db.prompts.toArray(),
      db.versions.toArray(),
    ]);

    const data: ExportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      scenes,
      prompts,
      versions,
    };

    const entry: SnapshotEntry = {
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      date: new Date().toISOString().slice(0, 10),
      data,
    };

    await db.snapshots.add(entry);

    // Keep only the latest MAX_SNAPSHOTS
    const all = await db.snapshots.orderBy('timestamp').reverse().toArray();
    while (all.length > MAX_SNAPSHOTS) {
      const oldest = all.pop()!;
      await db.snapshots.delete(oldest.id);
    }
  } catch {
    // Snapshot failures are non-critical
  } finally {
    localStorage.removeItem(LOCK_KEY);
  }
}

export async function getSnapshots(): Promise<SnapshotEntry[]> {
  try {
    return await db.snapshots.orderBy('timestamp').reverse().toArray();
  } catch {
    return [];
  }
}

// One-time migration: move old localStorage snapshots to IndexedDB
async function migrateFromLocalStorage(): Promise<void> {
  const OLD_KEY = 'ai-prompt-manager-snapshots';
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (!raw) return;
    const entries = JSON.parse(raw) as SnapshotEntry[];
    for (const entry of entries) {
      const exists = await db.snapshots.get(entry.id);
      if (!exists) await db.snapshots.add(entry);
    }
    localStorage.removeItem(OLD_KEY);
  } catch { /* migration failure is non-critical */ }
}

export async function hasTodaysSnapshot(): Promise<boolean> {
  await migrateFromLocalStorage();
  const today = new Date().toISOString().slice(0, 10);
  try {
    const count = await db.snapshots.where('date').equals(today).count();
    return count > 0;
  } catch {
    return false;
  }
}
