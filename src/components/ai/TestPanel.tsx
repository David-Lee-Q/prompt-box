import { useState, useRef, useEffect } from 'react';
import { Play, Loader2, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getCurrentProvider } from '@/services/ai';
import { AIError } from '@/services/ai/errors';
import { friendlyErrorMessage } from '@/services/ai/messages';
import { setVersionScore, setVersionTestOutput } from '@/services/scoreService';
import useSettingsStore from '@/store/settingsStore';
import StarRating from './StarRating';
import { toast } from '@/hooks/use-toast';

interface TestPanelProps {
  versionId: string;
  content: string;
  onClose: () => void;
}

export default function TestPanel({ versionId, content, onClose }: TestPanelProps) {
  const { isConfigured, setShowSettings } = useSettingsStore();
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const handleRun = async () => {
    const provider = getCurrentProvider();
    if (!provider) return;

    setIsRunning(true);
    setError(null);
    setOutput('');
    setScore(null);
    setSaved(false);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const fullOutput = await provider.streamChat(
        [{ role: 'user', content }],
        (text) => setOutput((prev) => prev + text),
        controller.signal
      );
      await setVersionTestOutput(versionId, fullOutput, provider.getConfig().model);
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (err instanceof AIError && err.code === 'cancelled') return;
      setError(friendlyErrorMessage(err, '测试运行失败'));
    } finally {
      setIsRunning(false);
      abortRef.current = null;
    }
  };

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleSaveScore = async () => {
    if (score === null) return;
    try {
      await setVersionScore(versionId, score);
      setSaved(true);
      toast({ title: '评分已保存', variant: 'success' });
    } catch (err) {
      toast({ title: '保存失败', variant: 'destructive', description: String(err) });
    }
  };

  if (!isConfigured) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-medium text-sm flex items-center gap-2">
            <Play className="h-4 w-4" />测试运行
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
        </div>
        <p className="text-sm text-muted-foreground mb-3">需要配置 API Key 才能运行测试</p>
        <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>前往设置</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 flex-shrink-0">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Play className="h-4 w-4" />测试运行
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        {/* Run / Stop */}
        <div className="flex items-center gap-2 mb-3 flex-shrink-0">
          {!isRunning && (
            <Button size="sm" onClick={handleRun}>
              <Play className="h-3.5 w-3.5 mr-1" />运行测试
            </Button>
          )}
          {isRunning && (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">运行中...</span>
              <Button size="sm" variant="outline" onClick={handleStop}>
                <Square className="h-3.5 w-3.5 mr-1" />停止
              </Button>
            </>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 mb-3 flex-shrink-0">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Output — fills remaining space */}
        <div className="flex-1 min-h-0 mb-3">
          {(isRunning || output) ? (
            <div className="rounded-md border bg-muted/30 p-3 h-full overflow-y-auto">
              <pre className="text-sm whitespace-pre-wrap font-sans">
                {output || <span className="text-muted-foreground animate-pulse">等待响应...</span>}
              </pre>
            </div>
          ) : <div className="flex-1" />}
        </div>

        {/* Score */}
        <div className="space-y-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">评分：</span>
            <StarRating value={score} onChange={setScore} />
            {score === null && <span className="text-xs text-muted-foreground">点击星标为此版本评分</span>}
            {score !== null && !saved && <span className="text-xs text-primary">{score} 分</span>}
          </div>
          <Button size="sm" onClick={handleSaveScore} disabled={score === null || saved} variant={saved ? 'outline' : 'default'}>
            {saved ? '已保存' : score === null ? '请先点击星标评分' : '保存评分'}
          </Button>
        </div>
      </div>
    </div>
  );
}
