const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;

interface FrontmatterEntry {
  key: string;
  lines: string[];
  complex: boolean;
}

function parseFrontmatterEntries(yaml: string): FrontmatterEntry[] {
  const lines = yaml.split(/\r?\n/);
  const entries: FrontmatterEntry[] = [];
  let current: FrontmatterEntry | null = null;

  const push = () => {
    if (current) entries.push(current);
    current = null;
  };

  for (const line of lines) {
    const keyMatch = line.match(/^([A-Za-z0-9_][A-Za-z0-9_-]*)\s*:(.*)$/);
    if (keyMatch && keyMatch[1]) {
      push();
      current = {
        key: keyMatch[1],
        lines: [keyMatch[2] !== undefined ? keyMatch[2].trim() : ''],
        complex: false,
      };
    } else if (current) {
      if (/^\s+\S/.test(line)) {
        current.complex = true;
        current.lines.push(line);
      } else if (line.trim() === '') {
        current.lines.push('');
        if (!current.complex) push();
      } else if (!current.complex) {
        current.lines.push(line);
      } else {
        current.lines.push(line);
      }
    }
  }
  push();
  return entries;
}

function stripQuotes(value: string): string {
  const v = value.trim();
  if (
    v.length >= 2 &&
    ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
  ) {
    return v.slice(1, -1).trim();
  }
  return v;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildHtmlTable(rows: Array<[string, string]>): string {
  const body = rows
    .map(([k, v]) => `<tr><td>${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join('');
  return `<table>\n<tbody>\n${body}\n</tbody>\n</table>`;
}

/**
 * 将文档开头的 YAML frontmatter 转为可读展示：
 * - 顶层标量键值 → 两列 HTML 表格（key / value）
 * - 嵌套结构（如 arguments 列表）→ 原样保留为 YAML 代码块
 * - 无法解析出任何键值时原样返回，避免丢失内容
 * 幂等：转换后的内容不再以 frontmatter 开头，重复调用无副作用。
 */
export function renderFrontmatterAsTable(markdown: string): string {
  const text = markdown.replace(/^\ufeff/, '');
  const m = text.match(FRONTMATTER_RE);
  if (!m || m[1] === undefined) return markdown;

  const entries = parseFrontmatterEntries(m[1]);
  const rows: Array<[string, string]> = [];
  const complexBlocks: string[] = [];

  for (const entry of entries) {
    if (entry.complex) {
      const firstValue = entry.lines[0] ?? '';
      const raw = [`${entry.key}:${firstValue ? ' ' + firstValue : ''}`, ...entry.lines.slice(1)]
        .join('\n')
        .trim();
      if (raw) complexBlocks.push(raw);
      continue;
    }
    const value = stripQuotes(entry.lines.map((l) => l.trim()).filter(Boolean).join(' '));
    if (value) rows.push([entry.key, value]);
  }

  if (rows.length === 0 && complexBlocks.length === 0) return markdown;

  const parts: string[] = [];
  if (rows.length > 0) parts.push(buildHtmlTable(rows));
  if (complexBlocks.length > 0) {
    parts.push('```yaml\n' + complexBlocks.join('\n') + '\n```');
  }

  const rest = text.slice(m[0].length).replace(/^\r?\n+/, '');
  return [...parts, rest].filter((p) => p !== '').join('\n\n');
}
