import { isExtension } from '@/utils/env';
import { copyToClipboard } from '@/utils/clipboard';

interface InsertResult { success: boolean; message: string; platform?: string; code?: 'INPUT_NOT_FOUND' | 'INPUT_NOT_EMPTY' | 'MULTIPLE_TABS'; }

interface PlatformInfo {
  domain: string;
  launchUrl: string;
}

const PLATFORM_INFO: Record<string, PlatformInfo> = {
  deepseek: { domain: 'chat.deepseek.com', launchUrl: 'https://chat.deepseek.com' },
  doubao: { domain: 'www.doubao.com', launchUrl: 'https://www.doubao.com/chat/' },
  kimi: { domain: 'www.kimi.com', launchUrl: 'https://www.kimi.com/' },
  qwen: { domain: 'www.qianwen.com', launchUrl: 'https://www.qianwen.com/chat' },
  chatgpt: { domain: 'chatgpt.com', launchUrl: 'https://chatgpt.com' },
  gemini: { domain: 'gemini.google.com', launchUrl: 'https://gemini.google.com' },
};

const PLATFORM_LABELS: Record<string, string> = {
  deepseek: 'DeepSeek',
  doubao: '豆包',
  kimi: 'Kimi',
  qwen: '千问',
  chatgpt: 'ChatGPT',
  gemini: 'Gemini',
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
        return { success: false, message: `无法定位输入框（${result?.detail || '页面可能尚未加载完'}）`, code: 'INPUT_NOT_FOUND' };
      }
      if (result?.error === 'INPUT_NOT_EMPTY') {
        return { success: false, message: `输入框已有内容（${result?.detail || ''}）`, code: 'INPUT_NOT_EMPTY' };
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
  platform: string
): Promise<{ tabId: number; isNew: boolean } | null> {
  const info = PLATFORM_INFO[platform];
  if (!info) return null;
  const domain = info.domain;
  const tabs = await chrome.tabs.query({ url: `*://${domain}/*` });

  if (tabs.length === 1 && tabs[0]?.id != null) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    return { tabId: tabs[0].id, isNew: false };
  }

  if (tabs.length > 1) {
    return null;
  }

  try {
    const newTab = await chrome.tabs.create({
      url: info.launchUrl,
      active: true,
    });
    if (!newTab.id) return null;
    await new Promise((r) => setTimeout(r, 3000));
    return { tabId: newTab.id, isNew: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[insertService] Failed to open tab for ${platform}: ${msg}`);
    return null;
  }
}

export async function insertPrompt(
  platform: string, text: string, preferredTabId?: number, force = false
): Promise<InsertResult> {
  const info = PLATFORM_INFO[platform];
  if (!info) return { success: false, message: `不支持的平台: ${platform}` };

  let tabId = preferredTabId;
  if (!tabId) {
    const target = await selectTargetTab(platform);
    if (!target) {
      const tabs = await getPlatformTabs(platform);
      if (tabs.length > 1) {
        return { success: false, message: '多个标签页', code: 'MULTIPLE_TABS', platform };
      }
      return { success: false, message: `无法打开 ${PLATFORM_LABELS[platform] || platform} 页面` };
    }
    tabId = target.tabId;
  }

  return sendMessageWithRetry(tabId, text, force);
}

export async function getPlatformTabs(platform: string) {
  const info = PLATFORM_INFO[platform];
  if (!info) return [];
  return chrome.tabs.query({ url: `*://${info.domain}/*` });
}

export function getAvailablePlatforms(): string[] {
  if (!isExtension()) return [];
  return Object.keys(PLATFORM_INFO);
}

export function getPlatformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] || platform;
}

// ── Web mode fallback ──

export async function copyPromptFallback(text: string): Promise<InsertResult> {
  const ok = await copyToClipboard(text);
  return { success: ok, message: ok ? '已复制到剪贴板' : '复制失败' };
}
