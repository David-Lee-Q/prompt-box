import { useState, useRef, useEffect } from 'react';
import type { AnalysisReport } from '@/services/promptAnalyzer';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChevronDown, ChevronRight, AlertTriangle, Shield, FileText, Zap, Eye, Hash, Check, X, Info } from 'lucide-react';

interface QualityAnalysisPanelProps {
  report: AnalysisReport | null;
  onRefresh: () => void;
  onClose: () => void;
}

const scoreColor = (s: number) =>
  s >= 75 ? 'text-green-600' : s >= 50 ? 'text-yellow-600' : 'text-red-600';

const barColor = (s: number) =>
  s >= 75 ? 'bg-green-500' : s >= 50 ? 'bg-yellow-500' : 'bg-red-500';

function DimBar({ label, score, icon }: { label: string; score: number; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 text-muted-foreground">{icon}</span>
      <span className="w-20 text-xs">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted">
        <div className={`h-full rounded-full ${barColor(score)}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-mono w-7 text-right ${scoreColor(score)}`}>{score}</span>
    </div>
  );
}

function PassFail({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs ${ok ? 'text-green-600' : 'text-muted-foreground'}`}>
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
      {label}
    </span>
  );
}

function CollapsibleSection({
  id,
  label,
  score,
  tooltip,
  expanded,
  onToggle,
  children,
}: {
  id: string;
  label: string;
  score: number;
  tooltip: string;
  expanded: boolean;
  onToggle: (id: string) => void;
  children: React.ReactNode;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleMouseEnter = () => {
    timerRef.current = setTimeout(() => setShowTooltip(true), 300);
  };
  const handleMouseLeave = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowTooltip(false);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  return (
    <div className="rounded-lg border">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center justify-between p-2.5 text-xs hover:bg-accent/50 transition-colors rounded-lg"
      >
        <span className="font-medium flex items-center gap-1">
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {label}
          <span className="relative ml-0.5" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
            <Info className="h-3 w-3 text-muted-foreground/40 hover:text-muted-foreground" />
            {showTooltip && (
              <span className="absolute left-0 bottom-full mb-1 w-48 px-2 py-1 rounded border bg-popover text-popover-foreground shadow text-[10px] leading-relaxed text-left z-50">
                {tooltip}
              </span>
            )}
          </span>
        </span>
        <span className={`font-mono ${scoreColor(score)}`}>{score}分</span>
      </button>
      {expanded && (
        <div className="px-2.5 pb-2.5 space-y-1.5 border-t pt-2">
          {children}
        </div>
      )}
    </div>
  );
}

const priorityDot = (p: string) =>
  p === 'high' ? 'bg-destructive' : p === 'medium' ? 'bg-yellow-500' : 'bg-muted-foreground';

export default function QualityAnalysisPanel({ report, onRefresh, onClose }: QualityAnalysisPanelProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (dim: string) => {
    const next = new Set(expanded);
    if (next.has(dim)) next.delete(dim); else next.add(dim);
    setExpanded(next);
  };

  if (!report) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm">质量分析</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
        </div>
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground mb-3">暂无分析数据</p>
          <button
            onClick={onRefresh}
            className="text-xs px-3 py-1.5 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            开始分析
          </button>
        </div>
      </div>
    );
  }

  const { overall, tokenEfficiency: te, specificity: sp, actionability: ac, readability: rd, security: se, suggestions } = report;

  const dims = [
    { key: 'specificity', label: '明确性', score: sp.score, icon: <FileText className="h-3.5 w-3.5" /> },
    { key: 'actionability', label: '可操作性', score: ac.score, icon: <Zap className="h-3.5 w-3.5" /> },
    { key: 'tokenEfficiency', label: 'Token 效率', score: te.score, icon: <Hash className="h-3.5 w-3.5" /> },
    { key: 'readability', label: '可读性', score: rd.score, icon: <Eye className="h-3.5 w-3.5" /> },
    { key: 'security', label: '安全性', score: se.score, icon: <Shield className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm flex items-center gap-2">质量分析</h3>
        <div className="flex items-center gap-1">
          <button onClick={onRefresh} className="text-xs text-muted-foreground hover:text-foreground mr-1">刷新</button>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-3 text-sm">
          {/* Overall score */}
          <div className="rounded-lg border p-3 text-center">
            <div className={`text-2xl font-bold ${scoreColor(overall.weighted)}`}>{overall.weighted}</div>
            <div className="text-xs text-muted-foreground">综合评分 / 100</div>
          </div>

          {/* Dimension bars */}
          <div className="rounded-lg border p-3 space-y-2">
            {dims.map((d) => (
              <DimBar key={d.key} label={d.label} score={d.score} icon={d.icon} />
            ))}
          </div>

          {/* Specificity details */}
          <CollapsibleSection id="specificity" label="明确性分析" score={sp.score} tooltip="检测输出格式、约束条件、角色定义和边界情况，标记模糊表述。权重 30%" expanded={expanded.has('specificity')} onToggle={toggle}>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <PassFail ok={sp.hasOutputFormat} label="输出格式" />
              <PassFail ok={sp.hasConstraints} label="约束条件" />
              <PassFail ok={sp.hasRoleDefinition} label="角色定义" />
              <PassFail ok={sp.hasEdgeCases} label="边界条件" />
            </div>
            {sp.vagueTerms.length > 0 && (
              <div className="text-xs">
                <span className="text-muted-foreground">模糊表述（{sp.vagueTerms.length}）：</span>
                {sp.vagueTerms.slice(0, 5).map((v, i) => (
                  <div key={i} className="ml-2 text-muted-foreground">
                    <span className="text-destructive">"{v.text}"</span> — {v.description}
                  </div>
                ))}
                {sp.vagueTerms.length > 5 && (
                  <div className="ml-2 text-xs text-muted-foreground">... 还有 {sp.vagueTerms.length - 5} 个</div>
                )}
              </div>
            )}
          </CollapsibleSection>

          {/* Actionability details */}
          <CollapsibleSection id="actionability" label="可操作性分析" score={ac.score} tooltip="检测强/弱动词分布、分步骤和输入/输出界定。权重 25%" expanded={expanded.has('actionability')} onToggle={toggle}>
            <div className="text-xs text-muted-foreground">
              强动词：<span className="text-green-600 font-medium">{ac.strongVerbCount}</span>
              <span className="mx-1">|</span>
              弱动词：<span className={ac.weakVerbCount > 0 ? 'text-destructive font-medium' : ''}>{ac.weakVerbCount}</span>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <PassFail ok={ac.hasSteps} label="分步骤" />
              <PassFail ok={ac.hasIOBoundary} label="输入/输出界定" />
            </div>
            {ac.weakVerbs.length > 0 && (
              <div className="text-xs">
                <span className="text-muted-foreground">弱动词：</span>
                {ac.weakVerbs.slice(0, 5).map((v, i) => (
                  <div key={i} className="ml-2 text-muted-foreground">
                    <span className="text-destructive">"{v.text}"</span>
                    <span className="ml-1">→ {v.suggestion}</span>
                  </div>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Token efficiency details */}
          <CollapsibleSection id="tokenEfficiency" label="Token 效率分析" score={te.score} tooltip="估算 Token 数量，检测啰嗦短语、重复行和礼貌用语膨胀。权重 20%" expanded={expanded.has('tokenEfficiency')} onToggle={toggle}>
            <div className="text-xs text-muted-foreground">
              预估 Token：<span className="font-mono text-foreground">~{te.estimatedTokens}</span>
              {te.cjkRatio > 0.1 && (
                <span className="ml-1">（中文占比 {Math.round(te.cjkRatio * 100)}%）</span>
              )}
            </div>
            {te.compressionRate > 0 && (
              <div className="text-xs">
                可压缩空间：<span className={te.compressionRate > 15 ? 'text-yellow-600 font-medium' : 'text-muted-foreground'}>
                  约 {te.compressionRate}%
                </span>
              </div>
            )}
            {te.verbosePhrases.length > 0 && (
              <div className="text-xs">
                <span className="text-muted-foreground">啰嗦短语：</span>
                {te.verbosePhrases.slice(0, 5).map((v, i) => (
                  <div key={i} className="ml-2 text-muted-foreground">
                    <span className="text-destructive line-through">"{v.text}"</span>
                    {v.suggestion && <span className="text-green-600 ml-1">→ "{v.suggestion}"</span>}
                  </div>
                ))}
                {te.verbosePhrases.length > 5 && (
                  <div className="ml-2 text-xs text-muted-foreground">... 还有 {te.verbosePhrases.length - 5} 处</div>
                )}
              </div>
            )}
            {te.redundantLines > 0 && (
              <div className="text-xs text-muted-foreground">重复行：{te.redundantLines} 处</div>
            )}
            {te.politenessBloat > 2 && (
              <div className="text-xs text-muted-foreground">礼貌用语膨胀：{te.politenessBloat} 处（系统指令中可省略）</div>
            )}
          </CollapsibleSection>

          {/* Readability details */}
          <CollapsibleSection id="readability" label="可读性分析" score={rd.score} tooltip="检测章节划分、Few-shot 示例数量、超长句和平均句长。权重 15%" expanded={expanded.has('readability')} onToggle={toggle}>
            <div className="text-xs text-muted-foreground">
              章节数：<span className="font-mono text-foreground">{rd.sectionCount}</span>
              <span className="mx-1">|</span>
              Few-shot 示例：<span className="font-mono text-foreground">{rd.fewShotCount}</span>
            </div>
            {rd.longSentenceCount > 0 && (
              <div className="text-xs text-muted-foreground">
                超长句（&gt;40词）：{rd.longSentenceCount} 句
                <span className="mx-1">|</span>
                平均句长：{rd.avgSentenceLength} 词
              </div>
            )}
          </CollapsibleSection>

          {/* Security details */}
          <CollapsibleSection id="security" label="安全性检查" score={se.score} tooltip="检测注入攻击模式和敏感信息泄露（邮箱、手机号、身份证号、IP地址）。权重 10%" expanded={expanded.has('security')} onToggle={toggle}>
            {se.injectionRisks.length === 0 && se.piiDetected.length === 0 && (
              <div className="text-xs text-green-600 flex items-center gap-1">
                <Check className="h-3 w-3" /> 未发现安全问题
              </div>
            )}
            {se.injectionRisks.length > 0 && (
              <div className="text-xs">
                <AlertTriangle className="h-3 w-3 inline text-destructive mr-1" />
                <span className="text-destructive font-medium">注入风险：</span>
                {se.injectionRisks.map((r, i) => (
                  <div key={i} className="ml-4 text-muted-foreground">
                    <span className={`${r.severity === 'high' ? 'text-destructive' : 'text-yellow-600'}`}>
                      [{r.severity === 'high' ? '高危' : '中危'}] "{r.text}"
                    </span>
                  </div>
                ))}
              </div>
            )}
            {se.piiDetected.length > 0 && (
              <div className="text-xs">
                <AlertTriangle className="h-3 w-3 inline text-destructive mr-1" />
                <span className="text-destructive font-medium">PII 信息：</span>
                {se.piiDetected.map((p, i) => (
                  <span key={i} className="ml-1 text-destructive">{p.type}（{p.count}）</span>
                ))}
              </div>
            )}
          </CollapsibleSection>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div className="rounded-lg border p-2.5">
              <div className="text-xs font-medium mb-2">优化建议</div>
              <div className="space-y-1.5">
                {suggestions.map((s, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    <span className={`inline-block w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0 ${priorityDot(s.priority)}`} />
                    <span className="text-muted-foreground">{s.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
