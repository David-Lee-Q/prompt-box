import { describe, it, expect } from 'vitest';
import { validateImportData } from './export-import';

describe('validateImportData', () => {
  const validData = {
    version: 1,
    scenes: [{ id: 's1', name: 'Test Scene', color: '#ff0000', icon: 'Folder', sortOrder: 0, createdAt: 0, updatedAt: 0 }],
    prompts: [{ id: 'p1', sceneId: 's1', name: 'Test', content: '', isStarred: false, currentVersionId: '', tags: [], notes: '', variables: [], createdAt: 0, updatedAt: 0 }],
    versions: [{ id: 'v1', promptId: 'p1', version: 'v1.0.0', content: '', changeLog: '', isProtected: true, isInitial: true, createdAt: 0 }],
  };

  it('accepts valid data', () => {
    const result = validateImportData(JSON.stringify(validData));
    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
  });

  it('rejects invalid JSON', () => {
    const result = validateImportData('not-json');
    expect(result.error).toBeDefined();
    expect(result.data).toBeUndefined();
  });

  it('rejects data missing scenes', () => {
    const { scenes, ...noScenes } = validData;
    const result = validateImportData(JSON.stringify(noScenes));
    expect(result.error).toBeDefined();
  });

  it('rejects data missing prompts', () => {
    const { prompts, ...noPrompts } = validData;
    const result = validateImportData(JSON.stringify(noPrompts));
    expect(result.error).toBeDefined();
  });

  it('rejects prompt referencing non-existent scene', () => {
    const bad = {
      ...validData,
      prompts: [{ ...validData.prompts[0], sceneId: 'nonexistent' }],
    };
    const result = validateImportData(JSON.stringify(bad));
    expect(result.error).toBeDefined();
  });

  it('accepts empty arrays (valid but empty import)', () => {
    const empty = {
      version: 1,
      scenes: [] as unknown[],
      prompts: [] as unknown[],
      versions: [] as unknown[],
    };
    const result = validateImportData(JSON.stringify(empty));
    expect(result.error).toBeUndefined();
    expect(result.data).toBeDefined();
  });
});
