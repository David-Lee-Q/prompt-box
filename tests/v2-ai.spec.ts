import { test, expect } from '@playwright/test';

test.describe('v2.0 AI 功能测试', () => {

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
    // Select the scene: click the scene button in the sidebar via the colored indicator
    const sidebar = page.locator('aside');
    const sceneBtn = sidebar.locator('button').filter({ hasText: name });
    await sceneBtn.first().click();
    await page.waitForTimeout(500);
  }

  async function createPrompt(page: any, name: string) {
    await page.getByPlaceholder('提示词名称').fill(name);
    await page.getByRole('button', { name: '保存' }).click();
    await page.waitForURL(/\/prompts\/(?!new)/, { timeout: 5000 });
    await page.waitForTimeout(500);
  }

  // ---- Step 1: Settings / API Key ----

  test('AI 设置按钮在 Header 中可见', async ({ page }) => {
    await expect(page.getByTitle('AI 设置')).toBeVisible();
  });

  test('AI 设置对话框可以打开和关闭', async ({ page }) => {
    await page.getByTitle('AI 设置').click();
    await expect(page.getByText('管理多个 AI 提供商')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.getByText('管理多个 AI 提供商')).not.toBeVisible();
  });

  test('AI 设置对话框包含添加提供商按钮', async ({ page }) => {
    await page.getByTitle('AI 设置').click();
    await expect(page.getByRole('button', { name: '添加提供商' })).toBeVisible();
  });

  test('点击添加提供商后显示配置表单', async ({ page }) => {
    await page.getByTitle('AI 设置').click();
    await page.getByRole('button', { name: '添加提供商' }).click();
    await expect(page.locator('#ai-provider')).toBeVisible();
    await expect(page.locator('#ai-format')).toBeVisible();
    await expect(page.locator('#ai-apikey')).toBeVisible();
    await expect(page.locator('#ai-model')).toBeVisible();
  });

  // ---- Step 3: Variable Template System ----

  test('含变量的 Prompt 显示变量填充面板', async ({ page }) => {
    await createSceneAndSelect(page, '测试场景');

    // Navigate to create prompt
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForURL('**/prompts/new**', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Type name and content with variables
    await page.getByPlaceholder('提示词名称').fill('翻译助手');

    // Focus CodeMirror editor and type variable template
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.waitForTimeout(300);
    await page.keyboard.type('请将以下内容翻译成{{language}}：{{text}}');

    // Wait for variable detection to trigger (React re-render)
    await page.waitForTimeout(1500);

    // Variable form should appear
    await expect(page.getByText('变量填充')).toBeVisible();
    await expect(page.getByPlaceholder('输入 language')).toBeVisible();
    await expect(page.getByPlaceholder('输入 text')).toBeVisible();
  });

  test('变量表单可以折叠展开', async ({ page }) => {
    await createSceneAndSelect(page, '测试场景');
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('提示词名称').fill('测试');

    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.type('{{foo}}');
    await page.waitForTimeout(500);

    // Click to collapse
    await page.getByText('变量填充').click();
    await page.waitForTimeout(300);

    // Input fields should be hidden
    const inputs = page.getByPlaceholder('输入 foo');
    await expect(inputs).not.toBeVisible();
  });

  test('无变量的 Prompt 不显示变量面板', async ({ page }) => {
    await createSceneAndSelect(page, '测试场景');
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('提示词名称').fill('普通提示词');

    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.type('这是一个没有变量的普通提示词');

    await page.waitForTimeout(500);

    // Variable form should NOT appear
    await expect(page.getByText('变量填充')).not.toBeVisible();
  });

  // ---- Step 4: AI Optimize ----

  test('AI 优化按钮在编辑器中出现', async ({ page }) => {
    await createSceneAndSelect(page, '测试场景');
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('提示词名称').fill('测试');

    // Fill content so the button appears
    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.type('请翻译');
    await page.waitForTimeout(300);

    // AI optimize button should be visible (may be disabled if no API key)
    await expect(page.getByRole('button', { name: 'AI 优化' })).toBeVisible();
  });

  test('未配置 API Key 时 AI 优化按钮禁用', async ({ page }) => {
    await createSceneAndSelect(page, '测试场景');
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForLoadState('networkidle');
    await page.getByPlaceholder('提示词名称').fill('测试');

    const editor = page.locator('.cm-editor .cm-content');
    await editor.click();
    await page.keyboard.type('测试内容');
    await page.waitForTimeout(300);

    const optimizeBtn = page.getByRole('button', { name: 'AI 优化' });
    await expect(optimizeBtn).toBeDisabled();
  });

  // ---- Step 5: Test Panel ----

  test('测试按钮在详情页操作栏可见', async ({ page }) => {
    await createSceneAndSelect(page, '测试场景');
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForLoadState('networkidle');
    await createPrompt(page, '测试提示词');

    await expect(page.getByRole('button', { name: '测试' })).toBeVisible();
  });

  test('测试面板可以打开', async ({ page }) => {
    await createSceneAndSelect(page, '测试场景');
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForLoadState('networkidle');
    await createPrompt(page, '测试提示词');

    await page.getByRole('button', { name: '测试' }).click();

    // When no API key configured, show guidance
    await expect(page.getByText('前往设置')).toBeVisible();
  });

  // ---- Step 6: Score Display ----

  test('版本列表显示评分区域', async ({ page }) => {
    await createSceneAndSelect(page, '测试场景');
    await page.getByRole('button', { name: '新建提示词' }).click();
    await page.waitForLoadState('networkidle');
    await createPrompt(page, '测试提示词');

    // Open version history
    await page.getByRole('button', { name: '版本历史' }).click();
    await page.waitForTimeout(500);

    // Version list should load with v1.0.0 visible
    await expect(page.getByText('v1.0.0').first()).toBeVisible();
  });
});
