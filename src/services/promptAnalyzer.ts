// ============================================================
// Prompt Quality Analyzer — 5-dimension diagnostic engine
// ============================================================

// --- Types ---------------------------------------------------

export interface VerbosePhrase {
  text: string;
  suggestion: string;
  savedChars: number;
}

export interface WeakVerb {
  text: string;
  position: number;
  suggestion: string;
}

export interface InjectionRisk {
  text: string;
  severity: 'high' | 'medium';
  position: number;
}

export interface PiiItem {
  type: string;
  count: number;
}

export interface ClarityIssue {
  type: string;
  text: string;
  description: string;
  position: number;
}

export interface TokenEfficiency {
  charCount: number;
  estimatedTokens: number;
  cjkRatio: number; // 0–1, proportion of CJK chars
  verbosePhrases: VerbosePhrase[];
  redundantLines: number;
  politenessBloat: number;
  compressionRate: number; // 0–100, % of tokens that could be saved
  score: number;
}

export interface Specificity {
  score: number;
  hasOutputFormat: boolean;
  hasConstraints: boolean;
  hasRoleDefinition: boolean;
  hasEdgeCases: boolean;
  vagueTerms: ClarityIssue[];
}

export interface Actionability {
  score: number;
  strongVerbCount: number;
  weakVerbCount: number;
  weakVerbs: WeakVerb[];
  hasSteps: boolean;
  hasIOBoundary: boolean;
}

export interface Readability {
  score: number;
  sectionCount: number;
  fewShotCount: number;
  longSentenceCount: number;
  avgSentenceLength: number;
}

export interface Security {
  score: number;
  injectionRisks: InjectionRisk[];
  piiDetected: PiiItem[];
}

export interface AnalysisSuggestion {
  text: string;
  priority: 'high' | 'medium' | 'low';
  dimension: string;
}

export interface AnalysisReport {
  overall: {
    tokenEfficiency: number;
    specificity: number;
    actionability: number;
    readability: number;
    security: number;
    weighted: number;
  };
  tokenEfficiency: TokenEfficiency;
  specificity: Specificity;
  actionability: Actionability;
  readability: Readability;
  security: Security;
  suggestions: AnalysisSuggestion[];
}

// --- CJK detection -------------------------------------------

const CJK_RE = /[一-鿿㐀-䶿豈-﫿぀-ゟ゠-ヿ]/g;

function detectLanguageMix(content: string): number {
  const cjkMatches = content.match(CJK_RE);
  const totalChars = content.replace(/\s/g, '').length || 1;
  return (cjkMatches?.length ?? 0) / totalChars;
}

// --- Smart token estimation ----------------------------------

function estimateTokensSmart(content: string, cjkRatio: number): number {
  const nonWs = content.replace(/\s/g, '').length;
  const cjkChars = nonWs * cjkRatio;
  const latinChars = nonWs * (1 - cjkRatio);
  return Math.round(cjkChars / 1.8 + latinChars / 3.5);
}

// --- Verbose phrase patterns ---------------------------------

interface VerbosePattern {
  regex: RegExp;
  suggestion: string;
  savedChars: number;
}

const VERBOSE_PATTERNS: VerbosePattern[] = [
  { regex: /in order to\b/gi, suggestion: 'to', savedChars: 8 },
  { regex: /due to the fact that\b/gi, suggestion: 'because', savedChars: 13 },
  { regex: /at this point in time\b/gi, suggestion: 'now', savedChars: 18 },
  { regex: /in the event that\b/gi, suggestion: 'if', savedChars: 15 },
  { regex: /it is important to note that\b/gi, suggestion: 'Note:', savedChars: 23 },
  { regex: /please note that\b/gi, suggestion: '', savedChars: 16 },
  { regex: /I would like you to\b/gi, suggestion: '', savedChars: 19 },
  { regex: /please kindly\b/gi, suggestion: '', savedChars: 13 },
  { regex: /if you don't mind,?\s*/gi, suggestion: '', savedChars: 17 },
  { regex: /I want you to\b/gi, suggestion: '', savedChars: 14 },
  { regex: /could you please\b/gi, suggestion: '', savedChars: 16 },
  { regex: /it is worth mentioning that\b/gi, suggestion: '', savedChars: 27 },
  { regex: /for the purpose of\b/gi, suggestion: 'for', savedChars: 15 },
  { regex: /in the process of\b/gi, suggestion: '', savedChars: 17 },
  { regex: /请你帮我[：:]?\s*/g, suggestion: '', savedChars: 4 },
  { regex: /麻烦你[：:]?\s*/g, suggestion: '', savedChars: 3 },
  { regex: /能不能[：:]?\s*/g, suggestion: '', savedChars: 3 },
  { regex: /可以的话[：:]?\s*/g, suggestion: '', savedChars: 4 },
  { regex: /希望能够[：:]?\s*/g, suggestion: '', savedChars: 4 },
  { regex: /请务必/g, suggestion: '必须', savedChars: 1 },
];

// --- Politeness bloat ----------------------------------------

const POLITENESS_RE = /\b(please|kindly|thank you|thanks|would you mind|if you could|I would appreciate)\b/gi;
const POLITENESS_CN_RE = /(麻烦|拜托|劳驾|谢谢|感谢)/g;

function detectPolitenessBloat(content: string): number {
  const en = (content.match(POLITENESS_RE) || []).length;
  const cn = (content.match(POLITENESS_CN_RE) || []).length;
  return en + cn;
}

// --- Redundancy detection ------------------------------------

function detectRedundantLines(content: string): number {
  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 30);
  const seen = new Set<string>();
  let duplicateCount = 0;
  for (const line of lines) {
    if (seen.has(line)) {
      duplicateCount++;
    } else {
      seen.add(line);
    }
  }
  return duplicateCount;
}

// --- Token efficiency analysis -------------------------------

function analyzeTokenEfficiency(content: string): TokenEfficiency {
  const charCount = content.length;
  const cjkRatio = detectLanguageMix(content);
  const estimatedTokens = estimateTokensSmart(content, cjkRatio);

  const verbosePhrases: VerbosePhrase[] = [];
  for (const p of VERBOSE_PATTERNS) {
    const matches = content.matchAll(p.regex);
    for (const m of matches) {
      verbosePhrases.push({ text: m[0], suggestion: p.suggestion, savedChars: p.savedChars });
    }
  }

  const redundantLines = detectRedundantLines(content);
  const politenessBloat = detectPolitenessBloat(content);

  const totalSavedChars = verbosePhrases.reduce((s, v) => s + v.savedChars, 0)
    + redundantLines * 30
    + politenessBloat * 5;
  const totalTokenEquivalent = charCount / 3.5;
  const compressionRate = totalTokenEquivalent > 0
    ? Math.min(80, Math.round((totalSavedChars / 3.5 / totalTokenEquivalent) * 100))
    : 0;

  let score = 100;
  score -= Math.min(verbosePhrases.length * 4, 30);
  score -= Math.min(redundantLines * 8, 30);
  score -= Math.min(politenessBloat * 2, 15);
  score = Math.max(0, score);

  return { charCount, estimatedTokens, cjkRatio, verbosePhrases, redundantLines, politenessBloat, compressionRate, score };
}

// --- Specificity analysis ------------------------------------

const VAGUE_PATTERNS: { regex: RegExp; type: string; desc: string }[] = [
  { regex: /\b(etc|et cetera|and so on)\b/gi, type: 'open-ended', desc: '开放式列举' },
  { regex: /\b(various|multiple|several|many)\b/gi, type: 'vague', desc: '数量词不精确' },
  { regex: /\b(appropriate|suitable|proper|relevant)\b/gi, type: 'subjective', desc: '主观判断词' },
  { regex: /\b(maybe|perhaps|possibly|might)\b/gi, type: 'vague', desc: '语气不确定' },
  { regex: /\b(stuff|things)\b/gi, type: 'vague', desc: '泛指名词' },
  { regex: /\b(some|a lot of|generally|usually|typically|normally)\b/gi, type: 'vague', desc: '数量/程度模糊' },
  { regex: /\b(do it right|make it pop|do a good job)\b/gi, type: 'subjective', desc: '主观期望' },
  { regex: /\b(handle it|deal with it|take care of it)\b/gi, type: 'vague', desc: '动作笼统' },
  { regex: /(做好|弄好|搞好|处理好|搞定)/g, type: 'vague', desc: '动词笼统' },
  { regex: /(弄一下|搞一下|整一下)/g, type: 'vague', desc: '动作模糊' },
  { regex: /(一些|某些|各种|等等)/g, type: 'vague', desc: '数量不精确' },
  { regex: /(差不多|大概|基本上|大致)/g, type: 'vague', desc: '范围模糊' },
  { regex: /(适当|合理|合适|恰当)/g, type: 'subjective', desc: '主观判断词' },
  { regex: /(尽量|尽可能|尽力)/g, type: 'vague', desc: '程度模糊' },
  { regex: /(似乎|好像)/g, type: 'vague', desc: '语气不确定' },
  { regex: /(一般来说|通常|一般|某个|几个)/g, type: 'vague', desc: '范围模糊' },
];

function analyzeSpecificity(content: string): Specificity {
  const issues: ClarityIssue[] = [];
  for (const p of VAGUE_PATTERNS) {
    const matches = content.matchAll(p.regex);
    for (const m of matches) {
      issues.push({ type: p.type, text: m[0], description: p.desc, position: m.index! });
    }
  }

  // Note: \b does not work with CJK characters in JS regex (CJK chars are not \w).
  // Chinese keywords are tested without \b; English keywords keep \b.
  const hasOutputFormat =
    /(JSON|XML|CSV|YAML|Markdown|HTML|表格|列表|代码|纯文本|图表|报告)/i.test(content) &&
    (/(返回|输出|格式|请以|呈现|生成为|产出)/.test(content) ||
      /\b(output|format|return|respond|reply|provide|generate|produce|render)\b/i.test(content));
  const hasConstraints =
    /(必须|不要|禁止|不能|不得|限制|最多|最少|不超过|不少于|至少|至多|范围|条件|只[能许可]|确保|必需|控制在|大于|小于)/.test(content) ||
    /\b(must|should|require|limit|only|exclude|at least|at most|no more than|shall)\b/i.test(content);
  const hasRoleDefinition =
    /(你是|你是一位|你充当|你担任|你的角色是|请扮演|假设你是|你作为|你将以|扮演.*角色)/.test(content) ||
    /\b(act as|you are a|you are an|you act as|you serve as|assume you are)\b/i.test(content);
  const hasEdgeCases =
    /(如果.*(?:则|那么|就)|假如|万一|当.*时.*(?:则|应|请)|异常.*处理|否则|备选方案|遇到.*时.*(?:则|应|请)|边界情况|异常情况|兜底)/.test(content) ||
    /\b(unless|otherwise|edge\s*case|corner\s*case|fallback|error\s*handling)\b/i.test(content);

  let score = 30;
  if (hasOutputFormat) score += 20;
  if (hasConstraints) score += 20;
  if (hasRoleDefinition) score += 15;
  if (hasEdgeCases) score += 15;
  score -= Math.min(issues.filter((i) => i.type !== 'open-ended').length * 3, 30);
  score = Math.max(0, Math.min(100, score));

  return { score, hasOutputFormat, hasConstraints, hasRoleDefinition, hasEdgeCases, vagueTerms: issues };
}

// --- Actionability analysis ----------------------------------

const WEAK_VERB_PATTERNS: { regex: RegExp; suggestion: string }[] = [
  { regex: /\bconsider\b/gi, suggestion: 'use "analyze" or "determine"' },
  { regex: /\btry to\b/gi, suggestion: 'use a direct verb' },
  { regex: /\bmight want to\b/gi, suggestion: 'remove or use direct verb' },
  { regex: /\bsuggest\b/gi, suggestion: 'use "recommend" or make it a directive' },
  { regex: /\bthink about\b/gi, suggestion: 'use "evaluate" or "assess"' },
  { regex: /\blook into\b/gi, suggestion: 'use "investigate" or "examine"' },
  { regex: /\bperhaps\b/gi, suggestion: 'remove qualifier' },
  { regex: /考虑/g, suggestion: '使用"分析"或"确定"' },
  { regex: /尝试/g, suggestion: '使用直接动词' },
  { regex: /也许/g, suggestion: '移除限定词' },
  { regex: /看看/g, suggestion: '使用"检查"或"审查"' },
];

const STRONG_VERB_RE = /\b(analyze|generate|list|return|create|execute|check|verify|validate|extract|calculate|format|parse|sort|filter|identify|determine|output|compute|transform|evaluate|assess|review|audit|summarize|compare|optimize|debug|refactor|translate|convert|merge|split|aggregate|count|query|fetch|retrieve|delete|update|replace|search|compile|classify|categorize|normalize|find)\b/gi;
const STRONG_VERB_CN_RE = /(分析|生成|列出|返回|创建|执行|检查|验证|提取|计算|格式化|排序|筛选|确定|输出|识别|转换|评估|审查|查找|搜索|汇总|分类|比较|对比|优化|调试|重构|翻译|合并|拆分|聚合|统计|查询|获取|删除|更新|插入|替换|总结|编译)/g;

function analyzeActionability(content: string): Actionability {
  const weakVerbs: WeakVerb[] = [];
  for (const p of WEAK_VERB_PATTERNS) {
    const matches = content.matchAll(p.regex);
    for (const m of matches) {
      weakVerbs.push({ text: m[0], position: m.index!, suggestion: p.suggestion });
    }
  }

  const strongEn = (content.match(STRONG_VERB_RE) || []).length;
  const strongCn = (content.match(STRONG_VERB_CN_RE) || []).length;
  const strongVerbCount = strongEn + strongCn;
  const weakVerbCount = weakVerbs.length;

  const hasSteps = /(步骤|第一步|第二步|Step\s*\d|^\d+[\.\)、]\s*|^[a-zA-Z][\.\)]\s)/im.test(content);
  const ioMatches = (content.match(/(输入|输出|给定|返回)/g) || []).length
    + (content.match(/\b(input|output)\b/gi) || []).length;
  const hasIOBoundary = ioMatches >= 2;

  let score = 25;
  if (strongVerbCount >= 3) score += 20;
  else if (strongVerbCount >= 1) score += 10;
  if (weakVerbCount === 0) score += 20;
  else if (weakVerbCount <= 2) score += 10;
  if (hasSteps) score += 20;
  if (hasIOBoundary) score += 15;
  score = Math.max(0, Math.min(100, score));

  return { score, strongVerbCount, weakVerbCount, weakVerbs, hasSteps, hasIOBoundary };
}

// --- Readability analysis ------------------------------------

function analyzeReadability(content: string): Readability {
  const sections: string[] = [];
  const hRegex = /^#{1,3}\s+(.+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = hRegex.exec(content)) !== null) sections.push(m[1]!);
  const labelRegex = /^([^\n]{1,40})[：:]/gm;
  while ((m = labelRegex.exec(content)) !== null) sections.push(m[1]!.trim());

  const fewShot = (content.match(/^(示例|例子|Example|Sample)[：:]/gm) || []).length;

  const sentences = content.split(/[。！？.!?\n]/).filter((s) => s.trim().length > 5);
  const wordCounts = sentences.map((s) => {
    const trimmed = s.trim();
    const cjkChars = (trimmed.match(CJK_RE) || []).length;
    // CJK: count characters; Latin: count whitespace-delimited words
    const latinWords = trimmed.replace(CJK_RE, '').trim().split(/\s+/).filter(Boolean).length;
    return cjkChars + latinWords;
  });
  const longSentenceThreshold = detectLanguageMix(content) > 0.5 ? 80 : 40;
  const longSentenceCount = wordCounts.filter((w) => w > longSentenceThreshold).length;
  const avgSentenceLength = sentences.length > 0
    ? Math.round(wordCounts.reduce((a, b) => a + b, 0) / sentences.length)
    : 0;

  const uniqueSectionCount = new Set(sections).size;
  let score = 40;
  if (uniqueSectionCount >= 2) score += 20;
  if (uniqueSectionCount >= 4) score += 10;
  if (fewShot > 0) score += 15;
  if (longSentenceCount === 0) score += 10;
  else if (longSentenceCount <= 2) score += 5;
  if (avgSentenceLength > 0 && avgSentenceLength <= 30) score += 5;

  return {
    score: Math.min(100, score),
    sectionCount: new Set(sections).size,
    fewShotCount: fewShot,
    longSentenceCount,
    avgSentenceLength,
  };
}

// --- Security analysis ---------------------------------------

const INJECTION_PATTERNS: { regex: RegExp; severity: 'high' | 'medium' }[] = [
  { regex: /ignore\s+(all\s+)?previous\s+(instructions?|prompts?)/gi, severity: 'high' },
  { regex: /<\|im_start\|>/gi, severity: 'high' },
  { regex: /<\|im_end\|>/gi, severity: 'high' },
  { regex: /\[system\]/gi, severity: 'high' },
  { regex: /forget\s+(everything|all)/gi, severity: 'high' },
  { regex: /DAN\s*mode/gi, severity: 'high' },
  { regex: /developer\s*mode/gi, severity: 'medium' },
  { regex: /you\s+are\s+now\s+(a\s+)?DAN/gi, severity: 'high' },
  { regex: /jailbreak/gi, severity: 'high' },
  { regex: /忽略(上述|之前的|以上)/g, severity: 'high' },
  { regex: /忘记(之前|上述|以上)/g, severity: 'high' },
  { regex: /现在开始.*(扮演|角色)/g, severity: 'medium' },
  { regex: /覆盖(指令|系统提示)/g, severity: 'high' },
  { regex: /重置(对话|指令)/g, severity: 'medium' },
];

const PII_PATTERNS: { regex: RegExp; type: string }[] = [
  { regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, type: '邮箱地址' },
  { regex: /\b1[3-9]\d{9}\b/g, type: '手机号码' },
  { regex: /\b\d{17}[\dXx]\b/g, type: '身份证号' },
  { regex: /\b(?:(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(?:25[0-5]|2[0-4]\d|[01]?\d\d?)\b/g, type: 'IP 地址' },
];

function analyzeSecurity(content: string): Security {
  const injectionRisks: InjectionRisk[] = [];
  for (const p of INJECTION_PATTERNS) {
    const matches = content.matchAll(p.regex);
    for (const m of matches) {
      injectionRisks.push({ text: m[0], severity: p.severity, position: m.index! });
    }
  }

  const piiDetected: PiiItem[] = [];
  for (const p of PII_PATTERNS) {
    const matches = content.match(p.regex) || [];
    if (matches.length > 0) {
      piiDetected.push({ type: p.type, count: matches.length });
    }
  }

  let score = 100;
  let injectionDeduction = 0;
  for (const r of injectionRisks) {
    injectionDeduction += r.severity === 'high' ? 25 : 10;
  }
  score -= Math.min(injectionDeduction, 50);
  score -= Math.min(piiDetected.length * 8, 30);
  score = Math.max(0, score);

  return { score, injectionRisks, piiDetected };
}

// --- Aggregator ----------------------------------------------

export function analyzePrompt(content: string): AnalysisReport {
  const tokenEfficiency = analyzeTokenEfficiency(content);
  const specificity = analyzeSpecificity(content);
  const actionability = analyzeActionability(content);
  const readability = analyzeReadability(content);
  const security = analyzeSecurity(content);

  const weighted = Math.round(
    specificity.score * 0.30 +
    actionability.score * 0.25 +
    tokenEfficiency.score * 0.20 +
    readability.score * 0.15 +
    security.score * 0.10
  );

  const suggestions: AnalysisSuggestion[] = [];

  // Token efficiency suggestions
  if (tokenEfficiency.verbosePhrases.length > 0) {
    suggestions.push({
      text: `发现 ${tokenEfficiency.verbosePhrases.length} 处啰嗦短语，优化可节省约 ${tokenEfficiency.verbosePhrases.reduce((s, v) => s + v.savedChars, 0)} 个字符`,
      priority: 'medium',
      dimension: 'tokenEfficiency',
    });
  }
  if (tokenEfficiency.redundantLines > 0) {
    suggestions.push({
      text: `发现 ${tokenEfficiency.redundantLines} 处重复行，删除可提升紧凑度`,
      priority: 'medium',
      dimension: 'tokenEfficiency',
    });
  }
  if (tokenEfficiency.compressionRate > 15) {
    suggestions.push({
      text: `整体可压缩空间约 ${tokenEfficiency.compressionRate}%，建议精简冗余内容`,
      priority: 'high',
      dimension: 'tokenEfficiency',
    });
  }

  // Specificity suggestions
  if (!specificity.hasOutputFormat) {
    suggestions.push({ text: '建议指定输出格式（如 JSON、Markdown）', priority: 'high', dimension: 'specificity' });
  }
  if (!specificity.hasConstraints) {
    suggestions.push({ text: '建议添加明确约束（必须/禁止/范围等）', priority: 'high', dimension: 'specificity' });
  }
  if (!specificity.hasRoleDefinition) {
    suggestions.push({ text: '建议定义 AI 角色或视角', priority: 'medium', dimension: 'specificity' });
  }
  if (!specificity.hasEdgeCases) {
    suggestions.push({ text: '建议覆盖异常/边界情况处理', priority: 'low', dimension: 'specificity' });
  }
  if (specificity.vagueTerms.length > 3) {
    suggestions.push({
      text: `发现 ${specificity.vagueTerms.length} 个模糊表述，建议替换为精确描述`,
      priority: 'medium',
      dimension: 'specificity',
    });
  }

  // Actionability suggestions
  if (actionability.weakVerbCount > actionability.strongVerbCount) {
    suggestions.push({
      text: `弱动词（${actionability.weakVerbCount}个）多于强动词（${actionability.strongVerbCount}个），建议使用更直接的指令词`,
      priority: 'medium',
      dimension: 'actionability',
    });
  }
  if (!actionability.hasSteps && content.length > 200) {
    suggestions.push({ text: '较长内容建议分步骤编号', priority: 'low', dimension: 'actionability' });
  }
  if (!actionability.hasIOBoundary && content.length > 100) {
    suggestions.push({ text: '建议明确定义输入与输出的边界', priority: 'medium', dimension: 'actionability' });
  }

  // Readability suggestions
  if (readability.sectionCount < 2 && content.length > 100) {
    suggestions.push({ text: '建议使用标题将内容分为多个段落', priority: 'medium', dimension: 'readability' });
  }
  if (readability.fewShotCount === 0 && content.length > 200) {
    suggestions.push({ text: '建议添加 1-3 个 Few-shot 示例', priority: 'low', dimension: 'readability' });
  }
  if (readability.longSentenceCount > 2) {
    suggestions.push({
      text: `发现 ${readability.longSentenceCount} 个超长句（>40词），建议拆分`,
      priority: 'low',
      dimension: 'readability',
    });
  }

  // Security suggestions
  if (security.injectionRisks.length > 0) {
    const highRisks = security.injectionRisks.filter((r) => r.severity === 'high');
    if (highRisks.length > 0) {
      suggestions.push({
        text: `发现 ${highRisks.length} 个高危注入模式，请立即检查`,
        priority: 'high',
        dimension: 'security',
      });
    }
  }
  if (security.piiDetected.length > 0) {
    suggestions.push({
      text: `发现 PII 信息：${security.piiDetected.map((p) => p.type).join('、')}`,
      priority: 'high',
      dimension: 'security',
    });
  }

  // Sort by priority
  const prio = { high: 0, medium: 1, low: 2 };
  suggestions.sort((a, b) => prio[a.priority] - prio[b.priority]);

  return {
    overall: {
      tokenEfficiency: tokenEfficiency.score,
      specificity: specificity.score,
      actionability: actionability.score,
      readability: readability.score,
      security: security.score,
      weighted,
    },
    tokenEfficiency,
    specificity,
    actionability,
    readability,
    security,
    suggestions,
  };
}
