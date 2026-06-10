// ============================================================
// Think block filter — strips model reasoning tags from output
// ============================================================

const THINK_BLOCK_RE: RegExp[] = [
  // DeepSeek R1 format (backslash-prefixed tags)
  /<\\think>[\s\S]*?<\\\/think>/gi,
  // Standard XML format (attribute-tolerant for opening tags)
  /<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi,
  /<think\b[^>]*>[\s\S]*?<\/think>/gi,
  // Bracket variants
  /\[THINKING\][\s\S]*?\[\/THINKING\]/gi,
  // CJK full-width variants
  /【思考】[\s\S]*?【\/思考】/gi,
];

export function stripThinkBlocks(text: string): string {
  let result = text;
  for (const re of THINK_BLOCK_RE) {
    result = result.replace(re, '');
  }
  return result.trim();
}
