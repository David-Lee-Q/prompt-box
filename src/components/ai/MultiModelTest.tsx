import { useState, useRef } from 'react';
import { Play, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ModelOutputCard from './ModelOutputCard';
import { getAIProvider } from '@/services/ai';
import useSettingsStore from '@/store/settingsStore';
import { copyToClipboard } from '@/utils/clipboard';
import { toast } from '@/hooks/use-toast';
import type { ProviderConfig } from '@/types/ai';

interface MultiModelTestProps {
  content: string;
  onClose: () => void;
}

interface TestItem {
  provider: ProviderConfig;
  output: string;
  latency: number;
  error?: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

export default function MultiModelTest({ content, onClose }: MultiModelTestProps) {
  const { settings } = useSettingsStore();
  const providers = settings?.providers?.filter((p) => p.apiKey) ?? [];
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<TestItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleSelectAll = () => {
    if (selected.size === providers.length) setSelected(new Set());
    else setSelected(new Set(providers.map((p) => p.id)));
  };

  const handleRunAll = async () => {
    const items = providers.filter((p) => selected.has(p.id));
    if (items.length === 0) return;
    setIsRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const initial: TestItem[] = items.map((provider) => ({
      provider, output: '', latency: 0, status: 'running' as const,
    }));
    setResults(initial);

    await Promise.allSettled(
      items.map(async (p, i) => {
        const startTime = Date.now();
        try {
          const aiProvider = getAIProvider(p.format, p.apiKey, p.model, p.baseUrl || undefined);
          const output = await aiProvider.streamChat(
            [{ role: 'user', content }],
            (text) => {
              setResults((prev) => {
                const next = [...prev];
                next[i] = { ...next[i]!, output: next[i]!.output + text };
                return next;
              });
            },
            controller.signal
          );
          setResults((prev) => {
            const next = [...prev];
            next[i] = { ...next[i]!, output, latency: Date.now() - startTime, status: 'done' };
            return next;
          });
        } catch (err) {
          if (err instanceof Error && err.name === 'AbortError') return;
          setResults((prev) => {
            const next = [...prev];
            next[i] = { ...next[i]!, error: String(err), status: 'error', latency: Date.now() - startTime };
            return next;
          });
        }
      })
    );
    setIsRunning(false);
    abortRef.current = null;
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  if (providers.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-sm">跨模型对比</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
        </div>
        <p className="text-sm text-muted-foreground">需要至少配置一个 AI 提供商</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 flex-shrink-0">
        <h3 className="font-medium text-sm flex items-center gap-2">跨模型对比</h3>
        <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Provider selection */}
        <div className="space-y-1.5 mb-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">选择模型（{selected.size}/{providers.length}）</span>
            <button onClick={handleSelectAll} className="text-xs text-primary hover:underline">
              {selected.size === providers.length ? '取消全选' : '全选'}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {providers.map((p) => (
              <button key={p.id} onClick={() => { const next = new Set(selected); if (next.has(p.id)) next.delete(p.id); else next.add(p.id); setSelected(next); }}
                className={`px-2 py-1 rounded-md text-xs transition-colors ${selected.has(p.id) ? 'bg-primary/10 text-primary font-medium' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                <span className="font-bold">{p.name}</span> · {p.model}
              </button>
            ))}
          </div>
        </div>

        {/* Run / Stop */}
        <div className="mb-3 flex-shrink-0">
          {!isRunning && <Button size="sm" onClick={handleRunAll} disabled={selected.size === 0}><Play className="h-3.5 w-3.5 mr-1" />同时运行</Button>}
          {isRunning && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground animate-pulse">运行中...</span>
              <Button size="sm" variant="outline" onClick={handleStop}><Square className="h-3.5 w-3.5 mr-1" />停止</Button>
            </div>
          )}
        </div>

        {/* Results — fills remaining space */}
        {results.length > 0 && (
          <div className="flex-1 min-h-0 flex gap-3 overflow-x-auto">
            {results.map((r) => (
              <ModelOutputCard key={r.provider.id} providerName={r.provider.name} model={r.provider.model} output={r.output} latency={r.latency} error={r.error} isLoading={r.status === 'running'}
                onCopy={async (text) => { const ok = await copyToClipboard(text); toast({ title: ok ? '已复制' : '复制失败', variant: ok ? 'success' : 'destructive' }); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
