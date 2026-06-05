import Dexie, { type EntityTable } from 'dexie';
import type { Scene, Prompt, Version } from '@/types';

const db = new Dexie('AIPromptManager') as Dexie & {
  scenes: EntityTable<Scene, 'id'>;
  prompts: EntityTable<Prompt, 'id'>;
  versions: EntityTable<Version, 'id'>;
};

db.version(1).stores({
  scenes: 'id, name, sortOrder, createdAt',
  prompts: 'id, sceneId, name, *tags, isStarred, createdAt, updatedAt',
  versions: 'id, promptId, version, createdAt',
});

export { db };
