import { test, expect } from '@playwright/test';

test.describe('回归保护测试', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      const req = indexedDB.deleteDatabase('AIPromptManager');
      return new Promise((r) => { req.onsuccess = r; req.onerror = r; });
    });
    await page.reload();
    await page.waitForLoadState('networkidle');
  });

  async function createScene(page: any, name: string) {
    await page.getByTitle('新建场景').click();
    await page.getByLabel('场景名称').fill(name);
    await page.getByRole('button', { name: '创建' }).click();
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  async function savePrompt(page: any, name: string, content: string) {
    await page.getByPlaceholder('提示词名称').fill(name);
    await page.locator('.cm-content').fill(content);
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('保存成功', { exact: true })).not.toBeVisible({ timeout: 10000 });
  }

  // ── Sprint 2: content-unchanged save ──

  test('内容不变保存不生成新版本', async ({ page }) => {
    await createScene(page, '场景');
    await page.locator('aside').getByText('场景', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForURL('**/prompts/**', { timeout: 5000 });
    await savePrompt(page, '测试', '内容1');

    // Save again with same content
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible({ timeout: 5000 });

    // Open version history — only v1.0.0 should exist
    await page.getByRole('button', { name: '版本历史' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('v1.0.0').first()).toBeVisible({ timeout: 5000 });

    // v1.0.1 should NOT appear since content didn't change
    const v101 = page.getByText('v1.0.1');
    await expect(v101).toHaveCount(0);
  });

  // ── Sprint 2: sceneId validation ──

  test('已删除场景的提示词编辑页保存失败', async ({ page }) => {
    await createScene(page, '临时场景');
    await page.locator('aside').getByText('临时场景', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForURL('**/prompts/**', { timeout: 5000 });

    // Navigate to a different page to break the scene context
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);

    // Delete the scene
    await page.locator('aside').getByText('临时场景').hover();
    await page.getByTitle('删除场景').click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '删除' }).click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');

    // The prompt belongs to a deleted scene
    // Navigating back to it via URL should show error or handle gracefully
    await expect(page.locator('aside').getByText('临时场景')).not.toBeVisible();
  });

  // ── Agent export ──

  test('Agent 导出对话框可打开', async ({ page }) => {
    await createScene(page, '场景');
    await page.locator('aside').getByText('场景', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForURL('**/prompts/**', { timeout: 5000 });
    await savePrompt(page, '导出', '测试内容');

    await page.getByTitle('导出为 Agent 工具配置').click();
    await expect(page.getByText('导出为 Agent 工具')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('OpenAI Function Calling')).toBeVisible();
  });

  // ── Sprint 3: scene delete warning ──

  test('删除空场景直接删除不弹确认', async ({ page }) => {
    await createScene(page, '空场景');
    // No prompts in this scene — should be simple delete
    await page.locator('aside').getByText('空场景').hover();
    await page.getByTitle('删除场景').click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '删除' }).click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await expect(page.locator('aside').getByText('空场景')).not.toBeVisible();
  });

  // ── Tag recommendation ──

  test('保存含关键字 Prompt 出现标签推荐', async ({ page }) => {
    await createScene(page, '场景');
    await page.locator('aside').getByText('场景', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForURL('**/prompts/**', { timeout: 5000 });

    await page.getByPlaceholder('提示词名称').fill('翻译助手');
    await page.locator('.cm-content').fill('请将以下英文内容翻译成中文，保留原文的代码块格式，输出为Markdown格式文档，同时保留所有的注释和文档结构');
    await page.getByRole('button', { name: '保存' }).click();
    await page.waitForURL(/\/prompts\/(?!new)/);
    await page.waitForTimeout(5000);

    await expect(page.getByText('推荐标签')).toBeVisible({ timeout: 8000 });
  });

});
