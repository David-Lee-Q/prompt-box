import { diff_match_patch, type Diff } from 'diff-match-patch';

const dmp = new diff_match_patch();

export function computeDiff(text1: string, text2: string): Diff[] {
  return dmp.diff_main(text1, text2);
}

export function diffToLines(diffs: Diff[]): { type: 'equal' | 'insert' | 'delete'; text: string }[] {
  const lines: { type: 'equal' | 'insert' | 'delete'; text: string }[] = [];
  for (const [op, text] of diffs) {
    const type = op === -1 ? 'delete' : op === 1 ? 'insert' : 'equal';
    const parts = text.split('\n');
    parts.forEach((line, i) => {
      if (i > 0) lines.push({ type: 'equal', text: '\n' });
      lines.push({ type, text: line });
    });
  }
  return lines;
}
