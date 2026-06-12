export interface InputTarget {
  element: HTMLElement;
  type: 'contenteditable' | 'textarea' | 'input';
}

function resolveSelectors(
  selectors: string[],
  defaultType: 'contenteditable' | 'textarea'
): InputTarget | null {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const tag = el.tagName.toUpperCase();
      return {
        element: el as HTMLElement,
        type: tag === 'TEXTAREA' || tag === 'INPUT' ? 'textarea' : defaultType,
      };
    }
  }
  return null;
}

function findVisibleTextarea(selector: string): InputTarget | null {
  const textareas = document.querySelectorAll(selector);
  for (const el of textareas) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 200 && rect.height > 40 && rect.bottom < window.innerHeight + 200) {
      return { element: el as HTMLElement, type: 'textarea' };
    }
  }
  return null;
}

// ── Platform finders (DeepSeek → 豆包 → Kimi → 千问 → ChatGPT → Gemini) ──

function findDeepSeekInput(): InputTarget | null {
  return resolveSelectors([
    '#chat-input',
    'textarea[placeholder*="Send a message"]',
  ], 'textarea') || findVisibleTextarea('textarea');
}

function findInShadowRoots(root: Document | ShadowRoot): InputTarget | null {
  // Search light DOM first
  const light = root.querySelectorAll('textarea');
  for (const el of light) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 100 && rect.height > 30) {
      return { element: el as HTMLElement, type: 'textarea' };
    }
  }
  // Recurse into shadow roots
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) {
      const found = findInShadowRoots(el.shadowRoot);
      if (found) return found;
    }
  }
  return null;
}

function findDoubaoInput(): InputTarget | null {
  // 豆包使用 Semi Design UI + DOUBAO-AI-CSUI Shadow DOM
  const direct = document.querySelector('textarea.semi-input-textarea')
    || document.querySelector('[data-testid="chat_input_input"]');
  if (direct) {
    return { element: direct as HTMLElement, type: 'textarea' };
  }
  return findInShadowRoots(document);
}

function findKimiInput(): InputTarget | null {
  return resolveSelectors([
    'div[contenteditable="true"]',
    'textarea',
  ], 'contenteditable');
}

function findQwenInput(): InputTarget | null {
  return resolveSelectors([
    'div[contenteditable="true"]',
    'textarea',
  ], 'contenteditable');
}

function findChatGPTInput(): InputTarget | null {
  return resolveSelectors([
    '#prompt-textarea',
    '[data-testid="prompt-textarea"]',
    'form [contenteditable="true"]',
  ], 'contenteditable');
}

function findGeminiInput(): InputTarget | null {
  return resolveSelectors([
    'rich-textarea [contenteditable="true"]',
    'div[role="textbox"][contenteditable]',
    '[contenteditable="true"]',
  ], 'contenteditable');
}

// ── Registry ──

const finders: Record<string, () => InputTarget | null> = {
  'chat.deepseek.com': findDeepSeekInput,
  'doubao.com': findDoubaoInput,
  'kimi.com': findKimiInput,             // covers kimi.com & kimi.moonshot.cn
  'kimi.moonshot.cn': findKimiInput,
  'qianwen.com': findQwenInput,
  'tongyi.aliyun.com': findQwenInput,
  'chatgpt.com': findChatGPTInput,
  'gemini.google.com': findGeminiInput,
};

export function detectPlatform(): string | null {
  const host = window.location.hostname;
  if (host.includes('deepseek.com')) return 'DeepSeek';
  if (host.includes('doubao.com')) return '豆包';
  if (host.includes('kimi.com') || host.includes('kimi.moonshot.cn')) return 'Kimi';
  if (host.includes('qianwen.com') || host.includes('tongyi.aliyun.com')) return '千问';
  if (host.includes('chatgpt.com')) return 'ChatGPT';
  if (host.includes('gemini')) return 'Gemini';
  return null;
}

export function findInputField(): InputTarget | null {
  const host = window.location.hostname;
  for (const [domain, finder] of Object.entries(finders)) {
    if (host.includes(domain)) {
      const result = finder();
      if (result) return result;
    }
  }
  return heuristicFindInput();
}

// ── 启发式兜底 ──

function heuristicFindInput(): InputTarget | null {
  const candidates = [
    ...Array.from(document.querySelectorAll('[contenteditable="true"]')),
    ...Array.from(document.querySelectorAll('textarea')),
  ];
  const visible = candidates
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 100 && rect.height > 30 && rect.bottom < window.innerHeight + 200;
    })
    .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);

  const best = visible[0] as HTMLElement | undefined;
  if (!best) return null;

  return {
    element: best,
    type: best.tagName === 'TEXTAREA' ? 'textarea' : 'contenteditable',
  };
}
