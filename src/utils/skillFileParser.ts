import JSZip from 'jszip';

export interface SkillParseResult {
  name: string;
  description: string;
  content: string;
  sourceName: string;
}

const CJK_RE = /[\u4e00-\u9fff]/;

export function containsChinese(text: string): boolean {
  return CJK_RE.test(text);
}

interface SkillMarkdownParts {
  fmName: string;
  fmDescription: string;
  h1: string;
  firstParagraph: string;
}

function stripQuotes(value: string): string {
  const v = value.trim();
  if (v.length >= 2 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
    return v.slice(1, -1).trim();
  }
  return v;
}

export function parseSkillMarkdown(markdown: string): SkillMarkdownParts {
  let fmName = '';
  let fmDescription = '';
  let body = markdown;

  const fmMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (fmMatch && fmMatch[1] !== undefined) {
    for (const line of fmMatch[1].split(/\r?\n/)) {
      const m = line.match(/^(name|description)\s*:\s*(.+)$/);
      if (!m || !m[1] || !m[2]) continue;
      const value = stripQuotes(m[2]);
      if (m[1] === 'name') fmName = value;
      else fmDescription = value;
    }
    const fmText = fmMatch[0];
    body = markdown.slice((fmMatch.index ?? 0) + fmText.length);
  }

  let h1 = '';
  const paraLines: string[] = [];
  let inFence = false;

  for (const line of body.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const trimmed = line.trim();

    if (!h1 && /^#\s+(.+)$/.test(trimmed)) {
      h1 = trimmed.replace(/^#\s+/, '').replace(/\s+#+\s*$/, '').trim();
    }

    if (paraLines.length === 0) {
      if (!trimmed) continue;
      if (/^#{1,6}\s/.test(trimmed)) continue;
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) continue;
      paraLines.push(trimmed);
    } else if (trimmed) {
      paraLines.push(trimmed);
      if (paraLines.length >= 3) break;
    } else {
      break;
    }
  }

  return {
    fmName,
    fmDescription,
    h1,
    firstParagraph: paraLines.join(' ').trim(),
  };
}

export function pickSkillName(fmName: string, h1: string): string {
  if (h1 && containsChinese(h1)) return h1;
  if (fmName && containsChinese(fmName)) return fmName;
  if (h1) return h1;
  return fmName;
}

export function pickSkillDescription(fmDescription: string, firstParagraph: string): string {
  if (fmDescription && containsChinese(fmDescription)) return fmDescription;
  if (firstParagraph && containsChinese(firstParagraph)) return firstParagraph;
  if (fmDescription) return fmDescription;
  return firstParagraph;
}

function buildResult(markdown: string, sourceName: string): SkillParseResult {
  const { fmName, fmDescription, h1, firstParagraph } = parseSkillMarkdown(markdown);
  return {
    name: pickSkillName(fmName, h1),
    description: pickSkillDescription(fmDescription, firstParagraph),
    content: markdown.replace(/^\ufeff/, '').trim(),
    sourceName,
  };
}

export async function parseSkillFile(file: File): Promise<SkillParseResult> {
  const fileName = file.name;

  if (/\.zip$/i.test(fileName)) {
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(file);
    } catch {
      throw new Error('无法读取 zip 文件，文件可能已损坏');
    }
    const candidates: string[] = zip
      .file(/(^|\/)skill\.md$/i)
      .map((f) => f.name);
    if (candidates.length === 0) {
      throw new Error('zip 包中未找到 SKILL.md 文件');
    }
    candidates.sort((a, b) => a.split('/').length - b.split('/').length);
    const entryName = candidates[0] as string;
    const entry = zip.file(entryName);
    if (!entry) throw new Error('zip 包中未找到 SKILL.md 文件');
    const text = await entry.async('text');
    return buildResult(text, fileName);
  }

  if (/\.md$/i.test(fileName)) {
    const text = await file.text();
    return buildResult(text, fileName);
  }

  throw new Error('不支持的文件类型，请上传 .zip 或 .md 技能文件');
}
