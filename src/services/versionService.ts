import { db } from '@/db';
import type { Version } from '@/types';
import { compareVersions } from '@/utils/version';

export async function getVersionsByPrompt(promptId: string, userId?: string): Promise<Version[]> {
  if (userId) {
    const prompt = await db.prompts.get(promptId);
    if (!prompt || prompt.userId !== userId) return [];
  }
  return db.versions
    .where('promptId')
    .equals(promptId)
    .reverse()
    .sortBy('createdAt');
}

export async function getVersion(id: string, userId?: string): Promise<Version | undefined> {
  const version = await db.versions.get(id);
  if (!version) return undefined;
  if (userId) {
    const prompt = await db.prompts.get(version.promptId);
    if (prompt && prompt.userId !== userId) return undefined;
  }
  return version;
}

export async function rollbackToVersion(promptId: string, versionId: string, userId?: string) {
  return db.transaction('rw', db.prompts, db.versions, async () => {
    const version = await db.versions.get(versionId);
    if (!version) throw new Error('版本不存在');
    if (version.promptId !== promptId) throw new Error('版本与提示词不匹配');

    const prompt = userId
      ? await db.prompts.where('id').equals(promptId).and(p => p.userId === userId).first()
      : await db.prompts.get(promptId);
    if (!prompt) throw new Error('提示词不存在');

    await db.prompts.update(promptId, {
      content: version.content,
      currentVersionId: versionId,
      updatedAt: Date.now(),
    });

    return db.prompts.get(promptId);
  });
}

export async function deleteVersion(id: string, userId?: string): Promise<void> {
  if (userId) {
    const version = await db.versions.get(id);
    if (version) {
      const prompt = await db.prompts.get(version.promptId);
      if (prompt && prompt.userId !== userId) throw new Error('无权删除此版本');
    }
  }
  await db.transaction('rw', db.versions, async () => {
    const version = await db.versions.get(id);
    if (!version) return;
    if (version.isProtected || version.isInitial) {
      throw new Error('受保护版本或初始版本不可删除');
    }
    await db.versions.delete(id);
  });
}

export async function toggleVersionProtection(id: string, isProtected: boolean, userId?: string): Promise<void> {
  const version = await db.versions.get(id);
  if (!version) return;
  if (version.isInitial) {
    throw new Error('初始版本不可修改保护状态');
  }
  if (userId) {
    const prompt = await db.prompts.get(version.promptId);
    if (prompt && prompt.userId !== userId) throw new Error('无权修改保护状态');
  }
  await db.versions.update(id, { isProtected });
}

export async function getVersionMap(promptIds: string[]): Promise<Record<string, string>> {
  if (promptIds.length === 0) return {};
  const versions = await db.versions
    .where('promptId')
    .anyOf(promptIds)
    .toArray();
  const map: Record<string, string> = {};
  for (const v of versions) {
    const existing = map[v.promptId];
    if (!existing || v.createdAt > (versions.find((x) => x.promptId === v.promptId && x.id === existing)?.createdAt ?? 0)) {
      map[v.promptId] = v.version;
    }
  }
  return map;
}

export async function getVersionsForDiff(promptId: string): Promise<Version[]> {
  const versions = await db.versions
    .where('promptId')
    .equals(promptId)
    .sortBy('createdAt');
  return versions.sort((a, b) => compareVersions(a.version, b.version));
}

