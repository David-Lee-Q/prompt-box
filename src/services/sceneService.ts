import { db } from '@/db';
import type { Scene } from '@/types';
import { generateId } from '@/utils/helpers';

export async function getScenes(): Promise<Scene[]> {
  return db.scenes.orderBy('sortOrder').toArray();
}

export async function getScene(id: string): Promise<Scene | undefined> {
  return db.scenes.get(id);
}

export async function createScene(data: Omit<Scene, 'id' | 'createdAt' | 'updatedAt'>): Promise<Scene> {
  const now = Date.now();
  const scene: Scene = {
    ...data,
    id: generateId(),
    createdAt: now,
    updatedAt: now,
  };
  await db.scenes.add(scene);
  return scene;
}

export async function updateScene(id: string, data: Partial<Omit<Scene, 'id' | 'createdAt'>>): Promise<void> {
  await db.scenes.update(id, { ...data, updatedAt: Date.now() });
}

export async function deleteScene(id: string): Promise<void> {
  await db.transaction('rw', db.scenes, db.prompts, db.versions, async () => {
    const promptsToDelete = await db.prompts.where('sceneId').equals(id).toArray();
    const promptIds = promptsToDelete.map((p) => p.id);

    if (promptIds.length > 0) {
      await db.versions.where('promptId').anyOf(promptIds).delete();
      await db.prompts.where('sceneId').equals(id).delete();
    }
    await db.scenes.delete(id);
  });
}
