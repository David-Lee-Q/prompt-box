// ============================================================
// Think block filter — strips model reasoning tags from output
// ============================================================

const THINK_BLOCK_RE: RegExp[] = [
  // DeepSeek R1: <\think>...</\think>
  /<\\think>[\s\S]*?<\\\/think>/gi,
  // DeepSeek R1 alt: <\think>...<\think> (same tag close)
  /<\\think>[\s\S]*?<\\think>/gi,
  // Backslash-open + normal-close: <\think>...</think>
  /<\\think>[\s\S]*?<\/think>/gi,
  // Standard XML: <thinking...>...</thinking>
  /<thinking\b[^>]*>[\s\S]*?<\/thinking>/gi,
  // Standard XML: <think...>...</think>
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
