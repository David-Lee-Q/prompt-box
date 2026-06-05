import { db } from '@/db';
import type { Prompt } from '@/types';
import { generateNextVersion } from '@/utils/version';
import { generateId } from '@/utils/helpers';

export async function getPromptsByScene(sceneId: string): Promise<Prompt[]> {
  return db.prompts
    .where('sceneId')
    .equals(sceneId)
    .reverse()
    .sortBy('updatedAt');
}

export async function getPrompt(id: string): Promise<Prompt | undefined> {
  return db.prompts.get(id);
}

export async function getStarredPrompts(): Promise<Prompt[]> {
  return db.prompts
    .filter((p) => p.isStarred)
    .toArray()
    .then((results) => results.sort((a, b) => b.updatedAt - a.updatedAt));
}

export async function getAllPrompts(): Promise<Prompt[]> {
  return db.prompts.toArray();
}

export async function savePrompt(
  prompt: Partial<Prompt> & { sceneId: string; name: string },
  changeLog: string = '更新内容'
) {
  return db.transaction('rw', db.prompts, db.versions, async () => {
    const now = Date.now();

    if (prompt.id) {
      const existingPrompt = await db.prompts.get(prompt.id);
      if (!existingPrompt) throw new Error('提示词不存在');

      const updatedContent = prompt.content ?? existingPrompt.content;
      const updatedPrompt = {
        ...existingPrompt,
        ...prompt,
        content: updatedContent,
        updatedAt: now,
      };

      await db.prompts.put(updatedPrompt);

      // 如果内容没有变化则不生成新版本
      if (updatedContent === existingPrompt.content) {
        return updatedPrompt;
      }

      const lastVersion = await db.versions
        .where('promptId')
        .equals(prompt.id)
        .reverse()
        .sortBy('createdAt');

      const latestVersion = lastVersion[0];

      // 如果最新版本是 v1.0.0 空白初始版本，直接更新它而非创建新版本
      if (latestVersion && latestVersion.content === '' && latestVersion.isInitial) {
        await db.versions.update(latestVersion.id, {
          content: updatedContent,
          changeLog,
        });
        await db.prompts.update(prompt.id, { currentVersionId: latestVersion.id });
        return updatedPrompt;
      }

      const nextVersion = generateNextVersion(latestVersion?.version);

      const versionId = await db.versions.add({
        id: generateId(),
        promptId: prompt.id,
        version: nextVersion,
        content: updatedContent,
        changeLog,
        isProtected: false,
        isInitial: false,
        createdAt: now,
      });

      await db.prompts.update(prompt.id, { currentVersionId: versionId });

      return { ...updatedPrompt, currentVersionId: versionId };
    } else {
      const id = generateId();
      await db.prompts.add({
        id,
        sceneId: prompt.sceneId,
        name: prompt.name || '未命名提示词',
        content: prompt.content || '',
        isStarred: false,
        currentVersionId: '',
        tags: [],
        notes: '',
        createdAt: now,
        updatedAt: now,
      });

      const versionId = await db.versions.add({
        id: generateId(),
        promptId: id,
        version: 'v1.0.0',
        content: prompt.content || '',
        changeLog: '初始版本',
        isProtected: true,
        isInitial: true,
        createdAt: now,
      });

      await db.prompts.update(id, { currentVersionId: versionId });
      return db.prompts.get(id);
    }
  });
}

export async function deletePrompt(id: string): Promise<void> {
  await db.transaction('rw', db.prompts, db.versions, async () => {
    await db.versions.where('promptId').equals(id).delete();
    await db.prompts.delete(id);
  });
}

export async function toggleStarPrompt(id: string, isStarred: boolean): Promise<void> {
  await db.prompts.update(id, { isStarred, updatedAt: Date.now() });
}

export async function updatePromptTags(id: string, tags: string[]): Promise<void> {
  await db.prompts.update(id, { tags, updatedAt: Date.now() });
}

export async function updatePromptNotes(id: string, notes: string): Promise<void> {
  await db.prompts.update(id, { notes, updatedAt: Date.now() });
}

export async function getAllTags(): Promise<string[]> {
  const all = await db.prompts.toArray();
  const tagSet = new Set<string>();
  for (const p of all) {
    for (const tag of p.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}

export async function getPromptsByTag(tag: string): Promise<Prompt[]> {
  return db.prompts
    .where('tags')
    .equals(tag)
    .reverse()
    .sortBy('updatedAt');
}

export async function updatePromptScene(id: string, sceneId: string): Promise<void> {
  await db.prompts.update(id, { sceneId, updatedAt: Date.now() });
}

export async function searchPrompts(query: string): Promise<Prompt[]> {
  const lower = query.toLowerCase();
  return db.prompts
    .filter((p) => p.name.toLowerCase().includes(lower) || p.content.toLowerCase().includes(lower))
    .toArray()
    .then((results) => results.sort((a, b) => b.updatedAt - a.updatedAt));
}
