import { isExtension } from '@/utils/env';
import { copyToClipboard } from '@/utils/clipboard';

interface InsertResult { success: boolean; message: string; platform?: string; code?: 'INPUT_NOT_FOUND' | 'INPUT_NOT_EMPTY' | 'MULTIPLE_TABS'; }

interface PlatformInfo {
  domain: string;
  launchUrl: string;
}

const PLATFORM_INFO: Record<string, PlatformInfo> = {
  deepseek: { domain: 'chat.deepseek.com', launchUrl: 'https://chat.deepseek.com' },
  doubao: { domain: 'doubao.com', launchUrl: 'https://www.doubao.com/chat/' },
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

// ── Tab loading listener ──

function waitForTabLoad(tabId: number, timeoutMs = 15000): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(false);
    }, timeoutMs);

    const listener = (updatedTabId: number, changeInfo: { status?: string }) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        // Give SPA extra hydration time after page load completes
        setTimeout(() => resolve(true), 2000);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

// ── Content script readiness check ──

async function isTabReady(tabId: number): Promise<boolean> {
  try {
    const res = await chrome.runtime.sendMessage({ type: 'IS_TAB_READY', tabId });
    return !!res;
  } catch {
    return false;
  }
}

async function waitForTabReady(tabId: number, timeoutMs = 12000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isTabReady(tabId)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// ── Message sending ──

async function sendMessageWithRetry(
  tabId: number, text: string, force: boolean, maxRetries = 3
): Promise<InsertResult> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const result = await chrome.tabs.sendMessage(tabId, {
        type: 'INSERT_PROMPT', text, force,
      });
      if (result?.success) return result;
      if (result?.error === 'INPUT_NOT_FOUND') {
        return { success: false, message: `无法定位输入框（${result?.detail || ''}）`, code: 'INPUT_NOT_FOUND' };
      }
      if (result?.error === 'INPUT_NOT_EMPTY') {
        return { success: false, message: `输入框已有内容（${result?.detail || ''}）`, code: 'INPUT_NOT_EMPTY' };
      }
    } catch {
      // Connection error — content script not loaded yet
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  return { success: false, message: '无法连接到页面，请刷新后重试' };
}

// ── Tab selection ──

async function selectTargetTab(
  platform: string
): Promise<{ tabId: number; isNew: boolean } | null> {
  const info = PLATFORM_INFO[platform];
  if (!info) return null;
  const tabs = await chrome.tabs.query({ url: `*://*.${info.domain}/*` });

  if (tabs.length >= 1 && tabs[0]?.id != null) {
    if (tabs.length > 1) return null; // multiple tabs — check BEFORE navigating
    // Navigate existing tab to chat page (may have been on settings/history)
    const loadPromise = waitForTabLoad(tabs[0].id); // register before update
    await chrome.tabs.update(tabs[0].id, {
      active: true,
      url: info.launchUrl,
    });
    await loadPromise;
    return { tabId: tabs[0].id, isNew: false };
  }

  // No existing tab — open new one
  try {
    const newTab = await chrome.tabs.create({
      url: info.launchUrl,
      active: true,
    });
    if (!newTab.id) return null;
    await waitForTabLoad(newTab.id);
    return { tabId: newTab.id, isNew: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[insertService] Failed to open tab for ${platform}: ${msg}`);
    return null;
  }
}

// ── Main entry ──

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

  // Wait for content script to signal readiness
  const ready = await waitForTabReady(tabId);
  if (!ready) {
    // Fallback: content script may be loaded but didn't signal — try anyway
    console.warn(`[insertService] Tab ${tabId} not marked ready, trying anyway`);
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
