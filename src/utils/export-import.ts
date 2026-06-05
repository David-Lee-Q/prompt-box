import { db } from '@/db';
import type { ExportData, Scene, Prompt } from '@/types';
import { generateId } from '@/utils/helpers';

type ConflictStrategy = 'overwrite' | 'skip' | 'rename';

export interface ImportResult {
  success: boolean;
  message: string;
  stats: { scenes: number; prompts: number; versions: number };
  conflicts: { type: 'scene' | 'prompt'; id: string; name: string }[];
}

function downloadJSON(data: ExportData, prefix: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportAllData(): Promise<void> {
  const [scenes, prompts, versions] = await Promise.all([
    db.scenes.toArray(),
    db.prompts.toArray(),
    db.versions.toArray(),
  ]);

  downloadJSON(
    { version: '1.0', exportedAt: new Date().toISOString(), scenes, prompts, versions },
    'ai-prompt-manager-backup'
  );
}

export async function exportScene(sceneId: string): Promise<void> {
  const scene = await db.scenes.get(sceneId);
  if (!scene) throw new Error('场景不存在');
  const prompts = await db.prompts.where('sceneId').equals(sceneId).toArray();
  const promptIds = prompts.map((p) => p.id);
  const versions = promptIds.length > 0
    ? await db.versions.where('promptId').anyOf(promptIds).toArray()
    : [];

  downloadJSON(
    { version: '1.0', exportedAt: new Date().toISOString(), scenes: [scene], prompts, versions },
    `scene-${scene.name}`
  );
}

export async function exportPrompt(promptId: string, includeVersions: boolean = true): Promise<void> {
  const prompt = await db.prompts.get(promptId);
  if (!prompt) throw new Error('提示词不存在');
  const versions = includeVersions
    ? await db.versions.where('promptId').equals(promptId).toArray()
    : [];

  const scene = await db.scenes.get(prompt.sceneId);

  downloadJSON(
    {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      scenes: scene ? [scene] : [],
      prompts: [prompt],
      versions,
    },
    `prompt-${prompt.name}`
  );
}

export function validateImportData(jsonStr: string): { data?: ExportData; error?: string } {
  let data: ExportData;
  try {
    data = JSON.parse(jsonStr);
  } catch {
    return { error: 'JSON 解析失败，请检查文件格式' };
  }

  if (
    !data.version ||
    !Array.isArray(data.scenes) ||
    !Array.isArray(data.prompts) ||
    !Array.isArray(data.versions)
  ) {
    return { error: '数据格式不完整，缺少 scenes/prompts/versions 字段' };
  }

  const sceneIds = new Set(data.scenes.map((s) => s.id));
  const promptIds = new Set(data.prompts.map((p) => p.id));

  for (const prompt of data.prompts) {
    if (!sceneIds.has(prompt.sceneId)) {
      return { error: `提示词 "${prompt.name}" 关联的场景 ID "${prompt.sceneId}" 不存在` };
    }
  }

  for (const version of data.versions) {
    if (!promptIds.has(version.promptId)) {
      return { error: `版本 "${version.version}" 关联的提示词 ID "${version.promptId}" 不存在` };
    }
  }

  return { data };
}

export async function detectConflicts(
  data: ExportData
): Promise<ImportResult['conflicts']> {
  const conflicts: ImportResult['conflicts'] = [];

  for (const scene of data.scenes) {
    const existing = await db.scenes.get(scene.id);
    if (existing) conflicts.push({ type: 'scene', id: scene.id, name: scene.name });
  }
  for (const prompt of data.prompts) {
    const existing = await db.prompts.get(prompt.id);
    if (existing) conflicts.push({ type: 'prompt', id: prompt.id, name: prompt.name });
  }

  return conflicts;
}

export async function importData(
  jsonStr: string,
  strategy: ConflictStrategy = 'skip'
): Promise<ImportResult> {
  const validation = validateImportData(jsonStr);
  if (validation.error) {
    return {
      success: false,
      message: validation.error,
      stats: { scenes: 0, prompts: 0, versions: 0 },
      conflicts: [],
    };
  }

  const data = validation.data!;
  const conflicts = await detectConflicts(data);
  const conflictIds = new Set(conflicts.map((c) => c.id));

  return db.transaction('rw', db.scenes, db.prompts, db.versions, async () => {
    let writeScenes: Scene[] = data.scenes;
    let writePrompts: Prompt[] = data.prompts;
    let idMapping = new Map<string, string>();

    if (strategy === 'rename') {
      // Regenerate IDs for conflicting items
      const renamedScenes: Scene[] = [];
      for (const scene of data.scenes) {
        if (conflictIds.has(scene.id)) {
          const newId = generateId();
          idMapping.set(scene.id, newId);
          renamedScenes.push({ ...scene, id: newId, name: `${scene.name} (导入)` });
        } else {
          renamedScenes.push(scene);
        }
      }
      writeScenes = renamedScenes;

      const renamedPrompts: Prompt[] = [];
      for (const prompt of data.prompts) {
        const newSceneId = idMapping.get(prompt.sceneId) ?? prompt.sceneId;
        if (conflictIds.has(prompt.id)) {
          const newId = generateId();
          idMapping.set(prompt.id, newId);
          renamedPrompts.push({ ...prompt, id: newId, sceneId: newSceneId });
        } else {
          renamedPrompts.push({ ...prompt, sceneId: newSceneId });
        }
      }
      writePrompts = renamedPrompts;

      // Remap version promptIds
      for (const version of data.versions) {
        version.promptId = idMapping.get(version.promptId) ?? version.promptId;
      }
    } else if (strategy === 'skip') {
      writeScenes = data.scenes.filter((item) => !conflictIds.has(item.id));
      writePrompts = data.prompts.filter((item) => !conflictIds.has(item.id));
    }

    // Write scenes
    for (const scene of writeScenes) {
      await db.scenes.put(scene);
    }

    // Write prompts
    for (const prompt of writePrompts) {
      await db.prompts.put(prompt);
    }

    // Write only versions for successfully imported prompts
    const importedPromptIds = new Set(writePrompts.map((p) => p.id));
    const writeVersions = data.versions.filter((v) => importedPromptIds.has(v.promptId));
    for (const version of writeVersions) {
      await db.versions.put(version);
    }

    return {
      success: true,
      message: `导入成功：${writeScenes.length} 个场景，${writePrompts.length} 个提示词${
        conflicts.length > 0
          ? `（${conflicts.length} 个冲突已${strategy === 'skip' ? '跳过' : strategy === 'rename' ? '重命名' : '覆盖'}）`
          : ''
      }`,
      stats: {
        scenes: writeScenes.length,
        prompts: writePrompts.length,
        versions: writeVersions.length,
      },
      conflicts,
    };
  });
}
