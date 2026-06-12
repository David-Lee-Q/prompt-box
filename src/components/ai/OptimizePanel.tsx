import { useState, useRef, useMemo, useEffect } from 'react';
import { Sparkles, Loader2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { optimizePrompt } from '@/services/ai';
import { AIError } from '@/services/ai/errors';
import { friendlyErrorMessage } from '@/services/ai/messages';
import { analyzePrompt } from '@/services/promptAnalyzer';
import type { OptimizeDimension } from '@/types/ai';
import useSettingsStore from '@/store/settingsStore';
import OptimizeDiff from './OptimizeDiff';

interface OptimizePanelProps {
  content: string;
  onApply: (optimized: string) => void;
  onClose: () => void;
}

const DIM_LABELS: Record<string, string> = {
  specificity: '明确性',
  actionability: '可操作性',
  tokenEfficiency: 'Token 效率',
  readability: '可读性',
  security: '安全性',
};

const PRESETS = [
  { name: '提取变量', text: '请将提示词中可替换的关键信息点（如角色名、任务主题、输出主题等）用 {{变量名}} 格式替换，使提示词成为可复用的模板' },
  { name: '更具体', text: '请将模糊表述替换为明确、可量化的指令，每项要求都要有具体的判断标准' },
  { name: '更简洁', text: '请删除冗余措辞和礼貌用语，用最精简的语言表达相同的指令，压缩 Token 用量' },
  { name: '丰富约束', text: '请检查并补充缺失的约束条件（输出格式、字数限制、禁止项、边界情况处理）' },
  { name: '强化角色', text: '请明确 AI 的角色定位、专业领域和输出视角，增强角色设定描述' },
  { name: '优化结构', text: '请用标题和编号重新组织结构，确保输入/输出界定清晰，任务步骤分明' },
];

function buildFindings(key: string, report: ReturnType<typeof analyzePrompt>): string {
  if (!report) return '';
  const parts: string[] = [];
  switch (key) {
    case 'specificity': {
      const s = report.specificity;
      if (!s.hasOutputFormat) {
        parts.push('未指定输出格式 — 请根据任务特点补充合适的输出格式要求（如 JSON、表格、Markdown 等）');
      }
      if (!s.hasConstraints) {
        parts.push('缺少可验证的约束条件 — 请添加数量、范围或禁止项等量化约束');
      }
      if (!s.hasRoleDefinition) {
        parts.push('未定义 AI 角色或专业视角 — 请用"你是一个…"句式设定匹配任务的身份');
      }
      if (!s.hasEdgeCases) {
        parts.push('未覆盖边界和异常情况 — 请补充"如果…则…"的异常处理逻辑');
      }
      if (s.vagueTerms.length > 0) {
        const terms = s.vagueTerms.slice(0, 5).map((v) =>
          `"${v.text}"（${v.description}）`
        ).join('、');
        parts.push(`发现模糊表述：${terms} — 请替换为可量化的具体描述`);
      }
      break;
    }
    case 'actionability': {
      const a = report.actionability;
      if (!a.hasSteps) {
        parts.push('任务未拆分为步骤 — 建议按工作流逻辑分解为清晰的子任务');
      }
      if (!a.hasIOBoundary) {
        parts.push('输入/输出边界不清晰 — 建议明确区分输入数据和期望输出');
      }
      if (a.weakVerbs.length > 0) {
        const verbs = a.weakVerbs.slice(0, 3).map((v) =>
          `"${v.text}"（建议：${v.suggestion}）`
        ).join('、');
        parts.push(`存在弱动词（${a.weakVerbCount}处）：${verbs}`);
      }
      break;
    }
    case 'tokenEfficiency': {
      const t = report.tokenEfficiency;
      if (t.compressionRate > 10) {
        parts.push(`约 ${t.compressionRate}% 内容可精简 — 删除冗余表述和重复内容`);
      }
      if (t.verbosePhrases.length > 0) {
        const phrases = t.verbosePhrases.slice(0, 3).map((v) =>
          `"${v.text}" → "${v.suggestion || '精简'}"`
        ).join('、');
        parts.push(`啰嗦短语：${phrases}`);
      }
      if (t.redundantLines > 0) {
        parts.push(`约 ${t.redundantLines} 处重复或高度相似内容需要合并`);
      }
      if (t.politenessBloat > 3) {
        parts.push('礼貌用语过多（请/谢谢/麻烦）— 系统指令中仅保留必要的');
      }
      break;
    }
    case 'readability': {
      const r = report.readability;
      if (r.sectionCount < 2) {
        parts.push('缺少章节结构 — 建议按逻辑主题分段，每段聚焦一个要点');
      }
      if (r.longSentenceCount > 0) {
        parts.push(`约 ${r.longSentenceCount} 个超长句（>40词）需拆分以提升可读性`);
      }
      if (r.avgSentenceLength > 25) {
        parts.push(`平均句长约 ${r.avgSentenceLength} 词偏长，建议缩短`);
      }
      break;
    }
    case 'security': {
      const se = report.security;
      if (se.injectionRisks.length > 0) {
        parts.push('发现疑似注入攻击模式，请移除相关指令');
      }
      if (se.piiDetected.length > 0) {
        parts.push('发现真实个人信息：' + se.piiDetected.map((p) => `${p.type}(${p.count}处)`).join('、') + '，请替换为占位符');
      }
      break;
    }
  }
  return parts.join('；');
}

export default function OptimizePanel({ content, onApply, onClose }: OptimizePanelProps) {
  const { isConfigured, setShowSettings } = useSettingsStore();
  const [instruction, setInstruction] = useState('');
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [result, setResult] = useState('');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isRunningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // Run quality analysis on mount
  const report = useMemo(() => analyzePrompt(content), [content]);

  // Initialize dimension checkboxes — default check low-score (<75) ones
  const [dims, setDims] = useState<OptimizeDimension[]>(() => {
    if (!report) return [];
    return (['specificity', 'actionability', 'tokenEfficiency', 'readability', 'security'] as const)
      .map((key) => {
        const scores = report.overall as Record<string, number>;
        const score = scores[key] ?? 75;
        return {
          key,
          label: DIM_LABELS[key] || key,
          score,
          enabled: score < 75,
          findings: buildFindings(key, report),
        };
      });
  });

  const toggleDim = (key: string) => {
    setDims((prev) => prev.map((d) => (d.key === key ? { ...d, enabled: !d.enabled } : d)));
  };

  // Inject enabled dimension findings into the instruction Textarea
  useEffect(() => {
    const enabledFindings = dims
      .filter((d) => d.enabled && d.findings)
      .map((d) => `【${d.label}】${d.findings}`)
      .join('\n');
    if (enabledFindings) {
      setInstruction(enabledFindings);
      setActivePreset(null);
    } else {
      setInstruction('');
    }
  }, [dims]);

  const handleOptimize = async () => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsOptimizing(true);
    setError(null);
    setResult('');
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const enabledDims = dims.filter((d) => d.enabled);
      const optimized = await optimizePrompt(
        { content, instruction: instruction || undefined, dimensions: enabledDims },
        (chunk) => {
          if (chunk.type === 'text') {
            setResult((prev) => prev + chunk.content);
          } else if (chunk.type === 'error') {
            setError(chunk.content);
          }
        },
        controller.signal
      );
      if (!optimized) {
        setError('AI 未返回优化结果');
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof AIError && err.code === 'cancelled') return;
      setError(friendlyErrorMessage(err, '优化请求失败'));
    } finally {
      isRunningRef.current = false;
      setIsOptimizing(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  if (!isConfigured) {
    return (
      <div className="space-y-3 rounded-lg border p-4">
        <div className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <span>AI 优化需要配置 API Key</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>
          前往设置
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">AI 优化</span>
      </div>

      {!result && !isOptimizing && (
        <>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => {
                  if (activePreset === p.name) {
                    setInstruction('');
                    setActivePreset(null);
                  } else {
                    setInstruction(p.text);
                    setActivePreset(p.name);
                  }
                }}
                className={`inline-flex items-center px-2 py-1 rounded text-xs border transition-colors ${
                  activePreset === p.name
                    ? 'bg-primary/10 border-primary text-primary'
                    : 'bg-muted border-border text-muted-foreground hover:bg-accent hover:text-foreground'
                }`}
              >
                {p.name}
              </button>
            ))}
          </div>
          <Textarea
            value={instruction}
            onChange={(e) => {
              setInstruction(e.target.value);
              if (e.target.value !== PRESETS.find((p) => p.name === activePreset)?.text) {
                setActivePreset(null);
              }
            }}
            placeholder="额外要求（可选），如：使输出更简洁、适合非技术读者..."
            className="min-h-[60px] text-sm"
          />
          {dims.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">质量分析诊断（勾选维度会传给 AI 针对性优化）：</div>
              <div className="flex flex-wrap gap-1.5">
                {dims.map((d) => (
                  <label
                    key={d.key}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs cursor-pointer border transition-colors ${
                      d.enabled ? 'bg-primary/10 border-primary text-primary' : 'bg-muted border-border text-muted-foreground hover:bg-accent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={d.enabled}
                      onChange={() => toggleDim(d.key)}
                      className="sr-only"
                    />
                    {d.label}
                    <span className={d.score >= 75 ? 'text-green-600' : d.score >= 50 ? 'text-yellow-600' : 'text-red-600'}>
                      {d.score}分
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={handleOptimize}>
              开始优化
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              取消
            </Button>
          </div>
        </>
      )}

      {isOptimizing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在优化...
          </div>
          {result && (
            <OptimizeDiff original={content} optimized={result} />
          )}
          <Button size="sm" variant="outline" onClick={handleCancel}>
            停止
          </Button>
        </div>
      )}

      {!isOptimizing && result && (
        <>
          <OptimizeDiff original={content} optimized={result} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onApply(result)}>
              <Check className="h-3.5 w-3.5 mr-1" />
              接受更改
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="h-3.5 w-3.5 mr-1" />
              忽略
            </Button>
          </div>
        </>
      )}

      {!isOptimizing && error && (
        <div className="text-sm text-destructive">{error}</div>
      )}
    </div>
  );
}
