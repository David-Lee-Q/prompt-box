import { db } from '@/db';
import type { Version } from '@/types';

export async function setVersionScore(
  versionId: string,
  score: number | null,
  userId?: string
): Promise<void> {
  if (userId) {
    const version = await db.versions.get(versionId);
    if (version) {
      const prompt = await db.prompts.get(version.promptId);
      if (prompt && prompt.userId !== userId) throw new Error('无权评分');
    }
  }
  await db.versions.update(versionId, { score: score ?? undefined });
}

export async function setVersionTestOutput(
  versionId: string,
  testOutput: string,
  modelInfo: string,
  userId?: string
): Promise<void> {
  if (userId) {
    const version = await db.versions.get(versionId);
    if (version) {
      const prompt = await db.prompts.get(version.promptId);
      if (prompt && prompt.userId !== userId) throw new Error('无权设置测试输出');
    }
  }
  await db.versions.update(versionId, { testOutput, modelInfo });
}

export async function getVersionsByScore(
  promptId: string,
  minScore: number = 4
): Promise<Version[]> {
  return db.versions
    .where('promptId')
    .equals(promptId)
    .filter((v) => v.score != null && v.score >= minScore)
    .toArray()
    .then((results) => results.sort((a, b) => b.score! - a.score!));
}
