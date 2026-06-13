// ============================================================
// Think block filter — strips model reasoning tags from output
// ============================================================

const THINK_BLOCK_RE: RegExp[] = [
  // Paired tags (with closing tag)
  /<\\think>[\s\S]*?<\\\/think>/gi,
  /<\\think>[\s\S]*?<\\think>/gi,
  /<\\think>[\s\S]*?<\/think>/gi,
  /<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi,
  /<think\b[^>]*>[\s\S]*?<\/think>/gi,
  /\[THINKING\][\s\S]*?\[\/THINKING\]/gi,
  /【思考】[\s\S]*?【\/思考】/gi,
  // Unclosed tags (no matching close — strip opening tag only)
  /<\\think>/gi,
  /<think\b[^>]*>/gi,
  /<thinking\b[^>]*>/gi,
  /\[THINKING\]/gi,
  /【思考】/gi,
];

export function stripThinkBlocks(text: string): string {
  let result = text;
  for (const re of THINK_BLOCK_RE) {
    result = result.replace(re, '');
  }
  return result.trim();
}
