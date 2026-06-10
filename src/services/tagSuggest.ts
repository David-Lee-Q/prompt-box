const KEYWORD_TAG_MAP: Record<string, string> = {
  '翻译': '翻译',
  'translate': '翻译',
  '文案': '营销文案',
  '营销': '营销文案',
  '广告': '营销文案',
  '代码': '代码',
  '编程': '代码',
  'code': '代码',
  '审查': '代码审查',
  'review': '代码审查',
  '客服': '客服',
  '客户': '客服',
  '邮件': '邮件',
  'email': '邮件',
  '摘要': '摘要',
  '总结': '摘要',
  'summarize': '摘要',
  '产品': '产品',
  'product': '产品',
  '写作': '写作',
  '文章': '写作',
  'writing': '写作',
  'JSON': '结构化输出',
  'JSON Schema': '结构化输出',
  'Markdown': '结构化输出',
  'API': 'API',
  'REST': 'API',
  '角色扮演': '角色扮演',
  'role': '角色扮演',
};

export interface TagSuggestion {
  tag: string;
  source: 'keyword' | 'existing';
}

export function suggestTags(
  content: string,
  existingTags: string[],
  existingAllTags: string[]
): TagSuggestion[] {
  const lower = content.toLowerCase();
  const suggestions: TagSuggestion[] = [];

  for (const [keyword, tag] of Object.entries(KEYWORD_TAG_MAP)) {
    if (lower.includes(keyword.toLowerCase())) {
      suggestions.push({ tag, source: 'keyword' });
    }
  }

  for (const tag of existingAllTags) {
    if (lower.includes(tag.toLowerCase())) {
      suggestions.push({ tag, source: 'existing' });
    }
  }

  const seen = new Set(existingTags);
  return suggestions
    .filter((s) => !seen.has(s.tag) && seen.add(s.tag))
    .slice(0, 5);
}
