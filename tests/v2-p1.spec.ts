import { test, expect } from '@playwright/test';

test.describe('v2.0 P1 功能测试', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const req = indexedDB.deleteDatabase('AIPromptManager');
      return new Promise((resolve) => {
        req.onsuccess = resolve;
        req.onerror = resolve;
      });
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  async function createSceneAndSelect(page: any, name: string) {
    await page.getByTitle('新建场景').click();
    await page.getByLabel('场景名称').fill(name);
    await expect(page.getByRole('button', { name: '创建' })).toBeEnabled({ timeout: 3000 });
    await page.getByRole('button', { name: '创建' }).click();
    await page.waitForTimeout(800);
    const sidebar = page.locator('aside');
    const sceneBtn = sidebar.locator('button').filter({ hasText: name });
    await sceneBtn.first().click();
    await page.waitForTimeout(500);
  }

  // ---- Step 9: AI Generate ----

  test('列表页 AI 生成按钮已移除', async ({ page }) => {
    // AI 生成按钮仅在提示词详情页显示，列表页不应出现
    await createSceneAndSelect(page, 'TestScene');
    await expect(page.getByRole('button', { name: 'AI生成' })).not.toBeVisible();
  });

  test('编辑器内 AI 生成按钮可见', async ({ page }) => {
    await createSceneAndSelect(page, 'TestScene');
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForURL(/\/prompts\/new/);
    await page.getByPlaceholder('提示词名称').fill('Test');
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.type('test');
    await page.waitForTimeout(500);
    await expect(page.getByRole('button', { name: '生成' })).toBeVisible();
  });

  test('未配置 API Key 时生成按钮禁用', async ({ page }) => {
    await createSceneAndSelect(page, 'TestScene');
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForURL(/\/prompts\/new/);
    await page.getByPlaceholder('提示词名称').fill('Test');

    await expect(page.getByRole('button', { name: '生成' })).toBeDisabled();
  });

  // ---- Step 10: Tag Suggestions ----

  // Tag suggestion covers the same flow as regression.spec.ts — keep it simple
  test('保存含关键字内容的 Prompt 后页面正常', async ({ page }) => {
    await createSceneAndSelect(page, 'TestScene');
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForURL(/\/prompts\/new/);
    await page.getByPlaceholder('提示词名称').fill('翻译助手');
    await page.locator('.cm-content').fill('请将以下英文内容翻译成中文并且保留原文的代码块格式输出为Markdown文档');
    await page.getByRole('button', { name: '保存' }).click();
    await page.waitForURL(/\/prompts\/(?!new)/);
    await expect(page.getByPlaceholder('提示词名称')).toHaveValue('翻译助手');
  });
});
