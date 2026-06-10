import { db } from '@/db';
import type { Version } from '@/types';

export async function setVersionScore(
  versionId: string,
  score: number | null
): Promise<void> {
  await db.versions.update(versionId, { score: score ?? undefined });
}

export async function setVersionTestOutput(
  versionId: string,
  testOutput: string,
  modelInfo: string
): Promise<void> {
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
