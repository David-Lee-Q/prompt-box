interface InputTarget {
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

// ── 国外平台 ──

function findChatGPTInput(): InputTarget | null {
  return resolveSelectors([
    '#prompt-textarea',
    '[data-testid="prompt-textarea"]',
    'form [contenteditable="true"]',
  ], 'contenteditable');
}

// ── 国内平台 ──

function findDeepSeekInput(): InputTarget | null {
  return resolveSelectors([
    '#chat-input',
    'textarea[placeholder*="Send a message"]',
    'textarea',
  ], 'textarea');
}

// ── 注册表 ──

const finders: Record<string, () => InputTarget | null> = {
  'chatgpt.com': findChatGPTInput,
  'chat.deepseek.com': findDeepSeekInput,
};

export function detectPlatform(): string | null {
  const host = window.location.hostname;
  if (host.includes('chatgpt.com')) return 'ChatGPT';
  if (host.includes('deepseek.com')) return 'DeepSeek';
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
