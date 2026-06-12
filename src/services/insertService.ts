import { isExtension } from '@/utils/env';
import { copyToClipboard } from '@/utils/clipboard';

interface InsertResult { success: boolean; message: string; platform?: string; code?: 'INPUT_NOT_FOUND' | 'INPUT_NOT_EMPTY' | 'MULTIPLE_TABS'; }

const DOMAIN_MAP: Record<string, string> = {
  chatgpt: 'chatgpt.com',
  deepseek: 'chat.deepseek.com',
};

const PLATFORM_LABELS: Record<string, string> = {
  chatgpt: 'ChatGPT',
  deepseek: 'DeepSeek',
};

async function sendMessageWithRetry(
  tabId: number, text: string, force: boolean, maxRetries = 5, baseDelay = 400
): Promise<InsertResult> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, {
        type: 'INSERT_PROMPT', text, force,
      });
      if (result?.success) return result;
      if (result?.error === 'INPUT_NOT_FOUND') {
        return { success: false, message: '无法定位输入框，请确认页面已完全加载', code: 'INPUT_NOT_FOUND' };
      }
      if (result?.error === 'INPUT_NOT_EMPTY') {
        return { success: false, message: '输入框已有内容', code: 'INPUT_NOT_EMPTY' };
      }
    } catch {
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, baseDelay * Math.pow(2, i)));
      }
    }
  }
  return { success: false, message: '无法连接到页面，请刷新后重试' };
}

async function selectTargetTab(
  domain: string
): Promise<{ tabId: number; isNew: boolean } | null> {
  const tabs = await chrome.tabs.query({ url: `*://${domain}/*` });

  if (tabs.length === 1 && tabs[0]?.id != null) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    return { tabId: tabs[0].id, isNew: false };
  }

  if (tabs.length > 1) {
    return null; // caller handles multi-tab UI
  }

  const newTab = await chrome.tabs.create({
    url: `https://${domain}`,
    active: true,
  });
  if (!newTab.id) return null;
  await new Promise((r) => setTimeout(r, 2000));
  return { tabId: newTab.id, isNew: true };
}

export async function insertPrompt(
  platform: string, text: string, preferredTabId?: number, force = false
): Promise<InsertResult> {
  const domain = DOMAIN_MAP[platform];
  if (!domain) return { success: false, message: `不支持的平台: ${platform}` };

  let tabId = preferredTabId;
  if (!tabId) {
    const target = await selectTargetTab(domain);
    if (!target) {
      return { success: false, message: '多个标签页', code: 'MULTIPLE_TABS', platform };
    }
    tabId = target.tabId;
  }

  return sendMessageWithRetry(tabId, text, force);
}

export async function getPlatformTabs(platform: string) {
  const domain = DOMAIN_MAP[platform];
  if (!domain) return [];
  return chrome.tabs.query({ url: `*://${domain}/*` });
}

export function getAvailablePlatforms(): string[] {
  if (!isExtension()) return [];
  return Object.keys(DOMAIN_MAP);
}

export function getPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] || platform;
}

// ── Web mode fallback ──

export async function copyPromptFallback(text: string): Promise<InsertResult> {
  const ok = await copyToClipboard(text);
  return { success: ok, message: ok ? '已复制到剪贴板' : '复制失败' };
}
