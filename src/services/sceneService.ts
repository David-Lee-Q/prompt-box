import { db } from '@/db';
import type { Scene } from '@/types';
import { generateId } from '@/utils/helpers';
import { PUBLIC_USER_ID } from '@/constants';

export async function getScenes(userId: string): Promise<Scene[]> {
  return db.scenes
    .where('userId')
    .anyOf([userId, PUBLIC_USER_ID])
    .sortBy('sortOrder');
}

export async function getScene(id: string): Promise<Scene | undefined> {
  return db.scenes.get(id);
}

export async function createScene(data: Omit<Scene, 'id' | 'createdAt' | 'updatedAt'>, userId: string): Promise<Scene> {
  const now = Date.now();
  const scene: Scene = {
    ...data,
    id: generateId(),
    userId,
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