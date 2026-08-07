import { db } from '@/db';
import type { Prompt } from '@/types';
import { generateNextVersion } from '@/utils/version';
import { generateId } from '@/utils/helpers';
import { extractVariables } from '@/utils/variables';
import { PUBLIC_USER_ID } from '@/constants';

function matchUserId(userId: string, recordUserId: string): boolean {
  return recordUserId === userId || recordUserId === PUBLIC_USER_ID;
}

export async function getPromptsByScene(sceneId: string, userId: string): Promise<Prompt[]> {
  return db.prompts
    .where('sceneId')
    .equals(sceneId)
    .filter((p) => matchUserId(userId, p.userId))
    .reverse()
    .sortBy('updatedAt');
}

export async function getPrompt(id: string, userId?: string): Promise<Prompt | undefined> {
  const prompt = await db.prompts.get(id);
  if (prompt && userId && !matchUserId(userId, prompt.userId)) return undefined;
  return prompt;
}

export async function getStarredPrompts(userId: string): Promise<Prompt[]> {
  return db.prompts
    .filter((p) => p.isStarred && matchUserId(userId, p.userId))
    .toArray()
    .then((results) => results.sort((a, b) => b.updatedAt - a.updatedAt));
}

export async function getAllPrompts(userId: string): Promise<Prompt[]> {
  return db.prompts.where('userId').anyOf([userId, PUBLIC_USER_ID]).toArray();
}

export async function savePrompt(
  prompt: Partial<Prompt> & { sceneId: string; name: string },
  changeLog: string = '更新内容',
  userId: string,
) {
  return db.transaction('rw', db.scenes, db.prompts, db.versions, async () => {
    const now = Date.now();

    // Validate sceneId exists to prevent orphan prompts
    const scene = await db.scenes.get(prompt.sceneId);
    if (!scene) throw new Error('场景不存在');

    if (prompt.id) {
      const existingPrompt = await db.prompts.get(prompt.id);
      if (!existingPrompt) throw new Error('提示词不存在');

      const updatedContent = prompt.content ?? existingPrompt.content;
      const variables = extractVariables(updatedContent);
      const contentChanged = updatedContent !== existingPrompt.content;
      const metaChanged = prompt.name !== undefined && prompt.name !== existingPrompt.name
        || prompt.sceneId !== undefined && prompt.sceneId !== existingPrompt.sceneId;

      // Always persist name/scene changes (even without content change)
      if (metaChanged) {
        await db.prompts.update(prompt.id, {
          name: prompt.name,
          sceneId: prompt.sceneId,
          ...(contentChanged ? { content: updatedContent, variables, updatedAt: now } : {}),
        });
      } else if (contentChanged) {
        await db.prompts.update(prompt.id, {
          content: updatedContent,
          variables,
          updatedAt: now,
        });
      }
      // If neither content nor metadata changed → no DB write at all

      // 如果内容没有变化则不生成新版本
      if (!contentChanged) {
        const current = await db.prompts.get(prompt.id);
        return current!;
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
        return db.prompts.get(prompt.id)!;
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
      const saved = await db.prompts.get(prompt.id);
      return { ...saved!, currentVersionId: versionId };
    } else {
      const id = generateId();
      const initialContent = prompt.content || '';
      const variables = extractVariables(initialContent);
      await db.prompts.add({
        id,
        userId,
        sceneId: prompt.sceneId,
        name: prompt.name || '未命名提示词',
        content: initialContent,
        isStarred: false,
        currentVersionId: '',
        tags: [],
        notes: '',
        variables,
        createdAt: now,
        updatedAt: now,
      });

      const versionId = await db.versions.add({
        id: generateId(),
        promptId: id,
        version: 'v1.0.0',
        content: initialContent,
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

export async function deletePrompt(id: string, userId?: string): Promise<void> {
  if (userId) {
    const prompt = await db.prompts.get(id);
    if (prompt && prompt.userId !== userId) throw new Error('无权删除此提示词');
  }
  await db.transaction('rw', db.prompts, db.versions, async () => {
    await db.versions.where('promptId').equals(id).delete();
    await db.prompts.delete(id);
  });
}

export async function toggleStarPrompt(id: string, isStarred: boolean, userId?: string): Promise<void> {
  if (userId) {
    const prompt = await db.prompts.get(id);
    if (prompt && prompt.userId !== userId) throw new Error('无权操作');
  }
  await db.prompts.update(id, { isStarred });
}

export async function updatePromptTags(id: string, tags: string[], userId?: string): Promise<void> {
  if (userId) {
    const prompt = await db.prompts.get(id);
    if (prompt && prompt.userId !== userId) throw new Error('无权更新标签');
  }
  await db.prompts.update(id, { tags, updatedAt: Date.now() });
}

export async function updatePromptNotes(id: string, notes: string, userId?: string): Promise<void> {
  if (userId) {
    const prompt = await db.prompts.get(id);
    if (prompt && prompt.userId !== userId) throw new Error('无权更新备注');
  }
  await db.prompts.update(id, { notes, updatedAt: Date.now() });
}

export async function updatePromptScene(id: string, sceneId: string, userId?: string): Promise<void> {
  if (userId) {
    const prompt = await db.prompts.get(id);
    if (prompt && prompt.userId !== userId) throw new Error('无权移动提示词');
  }
  await db.prompts.update(id, { sceneId, updatedAt: Date.now() });
}

export async function updatePromptCreateTime(id: string, createdAt: number, userId?: string): Promise<void> {
  if (userId) {
    const prompt = await db.prompts.get(id);
    if (prompt && prompt.userId !== userId) throw new Error('无权操作');
  }
  await db.prompts.update(id, { createdAt });
}

export async function getAllTags(userId: string): Promise<string[]> {
  const all = await db.prompts.where('userId').anyOf([userId, PUBLIC_USER_ID]).toArray();
  const tagSet = new Set<string>();
  for (const p of all) {
    for (const tag of p.tags) {
      tagSet.add(tag);
    }
  }
  return Array.from(tagSet).sort();
}

export async function getPromptsByTag(tag: string, userId: string): Promise<Prompt[]> {
  return db.prompts
    .where('tags')
    .equals(tag)
    .filter((p) => matchUserId(userId, p.userId))
    .reverse()
    .sortBy('updatedAt');
}

export async function searchPrompts(query: string, userId: string): Promise<Prompt[]> {
  const lower = query.toLowerCase();
  return db.prompts
    .filter((p) => matchUserId(userId, p.userId) && (p.name.toLowerCase().includes(lower) || p.content.toLowerCase().includes(lower)))
    .toArray()
    .then((results) => results.sort((a, b) => b.updatedAt - a.updatedAt));
}