import Dexie, { type EntityTable } from 'dexie';
import type { Scene, Prompt, Version, ExportData } from '@/types';

export interface SnapshotEntry {
  id: string;
  timestamp: number;
  date: string;
  data: ExportData;
}

const db = new Dexie('AIPromptManager') as Dexie & {
  scenes: EntityTable<Scene, 'id'>;
  prompts: EntityTable<Prompt, 'id'>;
  versions: EntityTable<Version, 'id'>;
  snapshots: EntityTable<SnapshotEntry, 'id'>;
};

db.version(1).stores({
  scenes: 'id, name, sortOrder, createdAt',
  prompts: 'id, sceneId, name, *tags, isStarred, createdAt, updatedAt',
  versions: 'id, promptId, version, createdAt',
});

db.version(2).stores({
  scenes: 'id, name, sortOrder, createdAt',
  prompts: 'id, sceneId, name, *tags, isStarred, createdAt, updatedAt',
  versions: 'id, promptId, version, score, createdAt',
});

db.version(3).stores({
  scenes: 'id, name, sortOrder, createdAt',
  prompts: 'id, sceneId, name, *tags, isStarred, createdAt, updatedAt',
  versions: 'id, promptId, version, score, createdAt',
  snapshots: 'id, date, timestamp',
});

export { db };
