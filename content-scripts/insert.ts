import { findInputField, detectPlatform } from './dom-finders';
import type { InputTarget } from './dom-finders';

// ── Text insertion ──

function insertViaClipboard(el: HTMLElement, text: string): boolean {
  try {
    el.focus();
    const dt = new DataTransfer();
    dt.setData('text/plain', text);
    el.dispatchEvent(new ClipboardEvent('paste', {
      clipboardData: dt, bubbles: true, cancelable: true,
    }));
    return true;
  } catch { return false; }
}

function insertViaProseMirror(el: HTMLElement, text: string): boolean {
  try {
    const view = (el as any).__proseMirrorView;
    if (view?.dispatch) {
      const tr = view.state.tr.insertText(text);
      view.dispatch(tr);
      view.focus();
      return true;
    }
    return false;
  } catch { return false; }
}

function insertIntoContentEditable(el: HTMLElement, text: string): boolean {
  if (insertViaClipboard(el, text)) return true;
  if (insertViaProseMirror(el, text)) return true;
  el.focus();
  el.textContent = text;
  // Use InputEvent for React 17+ synthetic event compatibility
  el.dispatchEvent(new InputEvent('input', {
    bubbles: true, cancelable: true, inputType: 'insertText', data: text,
  }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  const sel = window.getSelection();
  if (sel) { sel.selectAllChildren(el); sel.collapseToEnd(); }
  return true;
}

function insertIntoTextarea(el: HTMLTextAreaElement, text: string): void {
  el.focus();
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype, 'value'
  )?.set;
  if (nativeSetter) { nativeSetter.call(el, text); } else { el.value = text; }
  el.dispatchEvent(new InputEvent('input', {
    bubbles: true, cancelable: true, inputType: 'insertText', data: text,
  }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
}

function insertText(target: InputTarget, text: string): boolean {
  const sanitized = text.replace(/\x00/g, '');
  try {
    if (target.type === 'contenteditable') {
      return insertIntoContentEditable(target.element as HTMLElement, sanitized);
    }
    insertIntoTextarea(target.element as HTMLTextAreaElement, sanitized);
    return true;
  } catch {
    return false;
  }
}

// ── Overwrite check ──

function isInputNonEmpty(target: InputTarget): boolean {
  if (target.type === 'contenteditable') {
    // Some platforms have placeholder text in contenteditable — check innerText
    const text = (target.element as HTMLElement).innerText?.trim() || '';
    return text.length > 10;
  }
  return !!(target.element as HTMLTextAreaElement).value?.trim();
}

// ── Wait for input to appear in SPA (MutationObserver) ──

function waitForInput(timeoutMs = 15000): Promise<InputTarget | null> {
  return new Promise((resolve) => {
    if (!document.body) { resolve(null); return; }
    const immediate = findInputField();
    if (immediate) { resolve(immediate); return; }

    let resolved = false;
    const finish = (result: InputTarget | null) => {
      if (resolved) return;
      resolved = true;
      observer.disconnect();
      clearTimeout(timer);
      resolve(result);
    };

    const observer = new MutationObserver(() => {
      const found = findInputField();
      if (found) finish(found);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['contenteditable', 'class', 'style', 'placeholder'],
    });

    const timer = setTimeout(() => {
      // Last try before giving up
      finish(findInputField());
    }, timeoutMs);
  });
}

// ── Message handler ──

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'INSERT_PROMPT') {
    // Async wait for input — critical for SPAs that render input after page load
    waitForInput(15000).then((target) => {
      if (!target) {
        const taCount = document.querySelectorAll('textarea').length;
        const ceCount = document.querySelectorAll('[contenteditable="true"]').length;
        sendResponse({
          success: false,
          error: 'INPUT_NOT_FOUND',
          detail: `Waited 15s: ${taCount} textarea(s), ${ceCount} contenteditable(s)`,
        });
        return;
      }
      if (isInputNonEmpty(target) && !msg.force) {
        const existingText = target.type === 'contenteditable'
          ? (target.element as HTMLElement).innerText
          : (target.element as HTMLTextAreaElement).value;
        sendResponse({
          success: false, error: 'INPUT_NOT_EMPTY',
          detail: `Existing: "${existingText?.slice(0, 50)}"`,
        });
        return;
      }
      const ok = insertText(target, msg.text);
      sendResponse({ success: ok });
    });
    return true; // keep message channel open for async response
  }
  return false;
});

// ── Ready signal ──

chrome.runtime.sendMessage({
  type: 'CONTENT_SCRIPT_READY',
  platform: detectPlatform(),
});
