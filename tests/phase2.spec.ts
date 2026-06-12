import { test, expect } from '@playwright/test';

test.describe('阶段二功能测试', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Clear IndexedDB
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

  /** Helper: create a scene by clicking button, filling dialog, submitting */
  async function createScene(page: any, name: string) {
    await page.getByTitle('新建场景').click();
    await page.getByLabel('场景名称').fill(name);
    // Wait for button to become enabled
    await expect(page.getByRole('button', { name: '创建' })).toBeEnabled({ timeout: 3000 });
    await page.getByRole('button', { name: '创建' }).click();
    // Wait for dialog to fully unmount
    await page.waitForTimeout(500);
    // Close any lingering overlay with Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  test('1. 场景 CRUD 全流程', async ({ page }) => {
    // Create
    await page.getByTitle('新建场景').click();
    await page.getByLabel('场景名称').fill('测试场景');
    await expect(page.getByRole('button', { name: '创建' })).toBeEnabled({ timeout: 3000 });
    await page.getByRole('button', { name: '创建' }).click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('aside').getByText('测试场景')).toBeVisible();

    // Edit
    await page.locator('aside').getByText('测试场景').hover();
    await page.getByTitle('编辑场景').click();
    await page.getByLabel('场景名称').fill('编辑后的场景');
    await page.getByRole('button', { name: '保存' }).click();
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('aside').getByText('编辑后的场景')).toBeVisible();

    // Delete
    await page.locator('aside').getByText('编辑后的场景').hover();
    await page.getByTitle('删除场景').click();
    await page.getByText('删除').last().click();
    await expect(page.locator('aside').getByText('编辑后的场景')).not.toBeVisible();
  });

  test('2. 提示词创建与版本自动生成', async ({ page }) => {
    await createScene(page, '场景');
    await page.locator('aside').getByText('场景', { exact: true }).click();
    await page.waitForTimeout(300);

    await page.getByText('新建提示词').click();
    await page.waitForURL('**/prompts/**', { timeout: 5000 });

    const editor = page.locator('.cm-content');
    await editor.fill('第一版内容');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('保存成功', { exact: true })).not.toBeVisible({ timeout: 10000 });

    await editor.fill('第二版内容');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: '版本历史' }).click();
    await expect(page.getByText('v1.0.0').first()).toBeVisible();
    await expect(page.getByText('v1.0.1').first()).toBeVisible();
  });

  test('3. 内容不变不生成新版本', async ({ page }) => {
    await createScene(page, '场景');
    await page.locator('aside').getByText('场景', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByText('新建提示词').click();
    await page.waitForURL('**/prompts/**', { timeout: 5000 });

    const editor = page.locator('.cm-content');
    await editor.fill('内容不变量');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('保存成功', { exact: true })).not.toBeVisible({ timeout: 10000 });

    // Same content, save again
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: '版本历史' }).click();
    await expect(page.getByText('v1.0.0').first()).toBeVisible();
  });

  test('4. 版本回滚', async ({ page }) => {
    await createScene(page, '场景');
    await page.locator('aside').getByText('场景', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByText('新建提示词').click();
    await page.waitForURL('**/prompts/**', { timeout: 5000 });

    const editor = page.locator('.cm-content');
    await editor.fill('版本1');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('保存成功', { exact: true })).not.toBeVisible({ timeout: 10000 });

    await editor.fill('版本2');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible({ timeout: 5000 });

    // Version history & rollback
    await page.getByRole('button', { name: '版本历史' }).click();
    await page.waitForTimeout(500);
    // Multiple rollback buttons; the last one is for v1.0.0 (oldest)
    const rollbackBtns = page.getByTitle('回滚到此版本');
    await rollbackBtns.last().click();
    await expect(page.getByText('回滚成功', { exact: true })).toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);
    // Verify rollback: check version list shows correct version
    await expect(page.getByText('v1.0.0').first()).toBeVisible();
  });

  test('5. 版本对比功能', async ({ page }) => {
    await createScene(page, '场景');
    await page.locator('aside').getByText('场景', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByText('新建提示词').click();
    await page.waitForURL('**/prompts/**', { timeout: 5000 });

    const editor = page.locator('.cm-content');
    await editor.fill('第一版内容');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('保存成功', { exact: true })).not.toBeVisible({ timeout: 10000 });

    await editor.fill('第二版修改内容');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible({ timeout: 5000 });

    // Version diff
    await page.getByRole('button', { name: '版本对比' }).click();
    await expect(page.getByText('版本对比').first()).toBeVisible();
    await expect(page.locator('select').first()).toBeVisible();

    // Toggle side-by-side mode
    await page.getByTitle('并排对比模式').click();
    await page.waitForTimeout(200);
    await page.getByTitle('Inline 模式').click();
  });

  test('6. 复制功能', async ({ page }) => {
    await createScene(page, '场景');
    await page.locator('aside').getByText('场景', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByText('新建提示词').click();
    await page.waitForURL('**/prompts/**', { timeout: 5000 });

    const editor = page.locator('.cm-content');
    await editor.fill('可复制的内容');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible({ timeout: 5000 });

    // Copy button appears after save (not in create mode)
    await page.getByRole('button', { name: '复制' }).click();
    await page.waitForTimeout(500);
  });

  test('7. 收藏功能', async ({ page }) => {
    await createScene(page, '场景');
    await page.locator('aside').getByText('场景', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByText('新建提示词').click();
    await page.waitForURL('**/prompts/**', { timeout: 5000 });

    const editor = page.locator('.cm-content');
    await editor.fill('收藏测试');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible({ timeout: 5000 });

    // Go back to home page
    await page.goto('/');
    await page.waitForURL('/', { timeout: 5000 });
    await page.waitForTimeout(500);

    // Star the prompt card (click star icon)
    await page.waitForTimeout(500);
    const starIcon = page.locator('svg.lucide-star').first();
    await starIcon.click({ force: true });
    await page.waitForTimeout(500);

    // Click "已收藏" sidebar button
    await page.locator('aside button').filter({ hasText: '已收藏' }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('收藏测试')).toBeVisible({ timeout: 5000 });
  });

  test('8. 键盘快捷键', async ({ page }) => {
    await createScene(page, '场景');
    await page.locator('aside').getByText('场景', { exact: true }).click();
    await page.waitForTimeout(300);
    await page.getByText('新建提示词').click();
    await page.waitForURL('**/prompts/**', { timeout: 5000 });

    const editor = page.locator('.cm-content');
    await editor.fill('快捷键测试');

    // Ctrl+S to save
    await page.keyboard.press('Control+s');
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('9. 导出导入功能', async ({ page }) => {
    await createScene(page, '导出场景');
    await page.locator('aside').getByText('导出场景').click();
    await page.waitForTimeout(300);
    await page.getByText('新建提示词').click();
    await page.waitForURL('**/prompts/**', { timeout: 5000 });

    const editor = page.locator('.cm-content');
    await editor.fill('导出测试内容');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.getByText('保存成功', { exact: true })).toBeVisible({ timeout: 5000 });

    // Go back and export
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTitle('导出数据').click(),
    ]);
    expect(download.suggestedFilename()).toContain('ai-prompt-manager-backup');
  });
});
