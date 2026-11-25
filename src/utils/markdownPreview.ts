import DOMPurify from 'dompurify';
import { escapeHtml, renderFrontmatterAsTable } from './markdownFrontmatter';

const FENCE_LINE_RE = /^\s{0,3}(`{3,}|~{3,})/;
const SCRIPT_RE = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi;
const COMMENT_RE = /<!--[\s\S]*?-->/g;

export interface PreviewSegment {
  content: string;
  inFence: boolean;
  delimiter: boolean;
}

/**
 * 按围栏（``` / ~~~）行切分文档：
 * - 每个围栏定界行单独成段（delimiter: true）
 * - 围栏之间的内容属于 inFence 段
 * - 按顺序以 '\n' 连接各段可无损还原原文
 */
export function splitByFences(markdown: string): PreviewSegment[] {
  const lines = markdown.split('\n');
  const segments: PreviewSegment[] = [];
  let current: string[] = [];
  let inFence = false;

  const flush = () => {
    if (current.length > 0) {
      segments.push({ content: current.join('\n'), inFence, delimiter: false });
      current = [];
    }
  };

  for (const line of lines) {
    if (FENCE_LINE_RE.test(line)) {
      flush();
      inFence = !inFence;
      segments.push({ content: line, inFence: false, delimiter: true });
    } else {
      current.push(line);
    }
  }
  flush();
  return segments;
}

/**
 * 转换围栏外的不可见内容为可见内容：
 * - HTML 注释 <!-- ... --> → 转义后的可见文本段落
 * - <script> 块 → 原样保留的 ```html 代码块（DOMPurify 会整体删除 script，
 *   若不先移出消毒范围，整段内容会在预览中消失）
 * 注释先于脚本处理，避免注释内的 script 文本被误转。
 */
export function transformNonFenceSegment(text: string): string {
  const commentsReplaced = text.replace(COMMENT_RE, (m) => {
    const inner = m.slice(4, -3).trim();
    return inner ? `\n${escapeHtml(inner)}\n` : '';
  });
  return commentsReplaced.replace(SCRIPT_RE, (m) => `\n\`\`\`html\n${m}\n\`\`\`\n`);
}

function sanitizeHtml(html: string): string {
  if (typeof DOMPurify.sanitize === 'function' && DOMPurify.isSupported) {
    return DOMPurify.sanitize(html) as string;
  }
  return html;
}

/**
 * Markdown 预览前的完整管线：
 * 1. 开头 YAML frontmatter → 键值表格
 * 2. 围栏外：注释可见化、script 转 html 代码块
 * 3. 仅对围栏外文本做 DOMPurify 消毒（代码块内容是源码展示，原样保留）
 * 幂等：重复调用结果不变。
 */
export function prepareMarkdownPreview(markdown: string): string {
  const tabled = renderFrontmatterAsTable(markdown);
  const outer = splitByFences(tabled);
  return outer
    .map((seg) => {
      if (seg.delimiter || seg.inFence) return seg.content;
      const transformed = transformNonFenceSegment(seg.content);
      return splitByFences(transformed)
        .map((s) => (s.delimiter || s.inFence ? s.content : sanitizeHtml(s.content)))
        .join('\n');
    })
    .join('\n');
}
