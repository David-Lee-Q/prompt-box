export interface InputTarget {
  element: HTMLElement;
  type: 'contenteditable' | 'textarea' | 'input';
}

// ── Heuristic: visible, large, bottom-most input (ALWAYS used as fallback) ──

function heuristicFindInput(): InputTarget | null {
  const candidates = [
    ...Array.from(document.querySelectorAll('[contenteditable="true"]')),
    ...Array.from(document.querySelectorAll('textarea')),
  ];
  const visible = candidates
    .filter((el) => {
      const rect = el.getBoundingClientRect();
      return rect.width > 100 && rect.height > 20 && rect.bottom < window.innerHeight + 200;
    })
    .sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom);

  const best = visible[0] as HTMLElement | undefined;
  if (!best) return null;

  return {
    element: best,
    type: best.tagName === 'TEXTAREA' ? 'textarea' : 'contenteditable',
  };
}

// ── Generic helper: try exact selectors first, then fall to heuristic ──

function tryExact(selectors: string[]): InputTarget | null {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const rect = el.getBoundingClientRect();
      // Min height 20px — some platforms use auto-resize textareas (初始 ~24px)
      if (rect.width > 100 && rect.height > 20) {
        const tag = el.tagName.toUpperCase();
        return {
          element: el as HTMLElement,
          type: tag === 'TEXTAREA' || tag === 'INPUT' ? 'textarea' : 'contenteditable',
        };
      }
    }
  }
  return null;
}

// ── Platform finders: exact selectors first, then heuristic ──

function findDeepSeekInput(): InputTarget | null {
  return tryExact(['#chat-input', 'textarea[placeholder*="Send"]']) || heuristicFindInput();
}

function findDoubaoInput(): InputTarget | null {
  const direct = tryExact(['textarea.semi-input-textarea', '[data-testid="chat_input_input"]']);
  if (direct) return direct;
  // Shadow DOM search
  return findInShadowRoots(document) || heuristicFindInput();
}

function findInShadowRoots(root: Document | ShadowRoot): InputTarget | null {
  // Collect all valid candidates from all shadow layers, then pick bottom-most
  const candidates: InputTarget[] = [];
  collectTextareas(root, candidates);
  return pickBottomMost(candidates);
}

function collectTextareas(root: Document | ShadowRoot, out: InputTarget[]): void {
  const textareas = root.querySelectorAll('textarea');
  for (const el of textareas) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 100 && rect.height > 20) {
      out.push({ element: el as HTMLElement, type: 'textarea' });
    }
  }
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) {
      collectTextareas(el.shadowRoot, out);
    }
  }
}

function pickBottomMost(candidates: InputTarget[]): InputTarget | null {
  if (candidates.length === 0) return null;
  return candidates.sort((a, b) =>
    b.element.getBoundingClientRect().bottom - a.element.getBoundingClientRect().bottom
  )[0]!;
}

function findKimiInput(): InputTarget | null {
  return heuristicFindInput();
}

function findQwenInput(): InputTarget | null {
  return heuristicFindInput();
}

function findChatGPTInput(): InputTarget | null {
  return tryExact(['#prompt-textarea', '[data-testid="prompt-textarea"]']) || heuristicFindInput();
}

function findGeminiInput(): InputTarget | null {
  return tryExact(['rich-textarea [contenteditable="true"]', 'div[role="textbox"][contenteditable]']) || heuristicFindInput();
}

// ── Registry ──

const finders: Record<string, () => InputTarget | null> = {
  'chat.deepseek.com': findDeepSeekInput,
  'doubao.com': findDoubaoInput,
  'kimi.com': findKimiInput,
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
