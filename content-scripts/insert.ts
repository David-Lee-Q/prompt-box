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
  el.dispatchEvent(new Event('input', { bubbles: true }));
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
  el.dispatchEvent(new Event('input', { bubbles: true }));
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
    return !!(target.element as HTMLElement).textContent?.trim();
  }
  return !!(target.element as HTMLTextAreaElement).value?.trim();
}

// ── Message handler ──

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'INSERT_PROMPT') {
    const target = findInputField();
    if (!target) {
      sendResponse({ success: false, error: 'INPUT_NOT_FOUND' });
      return;
    }
    if (isInputNonEmpty(target) && !msg.force) {
      sendResponse({ success: false, error: 'INPUT_NOT_EMPTY' });
      return;
    }
    const ok = insertText(target, msg.text);
    sendResponse({ success: ok });
  }
});

// ── Ready signal ──

chrome.runtime.sendMessage({
  type: 'CONTENT_SCRIPT_READY',
  platform: detectPlatform(),
});
