import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getVersionsForDiff } from '@/services/versionService';
import { computeDiff, diffToLines } from '@/utils/diff';
import { formatDate } from '@/utils/helpers';
import type { Version } from '@/types';
import { ArrowLeftRight, Columns2, AlignLeft } from 'lucide-react';

interface VersionDiffProps {
  promptId: string;
  onClose: () => void;
}

type DiffMode = 'inline' | 'side-by-side';

export default function VersionDiff({ promptId, onClose }: VersionDiffProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [leftVer, setLeftVer] = useState<string>('');
  const [rightVer, setRightVer] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [diffMode, setDiffMode] = useState<DiffMode>('inline');

  useEffect(() => {
    getVersionsForDiff(promptId).then((v) => {
      setVersions(v);
      if (v.length >= 2) {
        setLeftVer(v[v.length - 2]!.id);
        setRightVer(v[v.length - 1]!.id);
      }
      setLoading(false);
    });
  }, [promptId]);

  const left = versions.find((v) => v.id === leftVer);
  const right = versions.find((v) => v.id === rightVer);

  const diffs = left && right ? computeDiff(left.content, right.content) : [];
  const lineDiffs = left && right ? diffToLines(diffs) : [];

  const handleSwap = () => {
    const tmp = leftVer;
    setLeftVer(rightVer);
    setRightVer(tmp);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground text-center py-8">加载中...</div>;
  }

  if (versions.length < 2) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        需要至少两个版本才能进行对比
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <ArrowLeftRight className="h-4 w-4" />
          版本对比
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setDiffMode('inline')}
            className={`p-1 rounded ${diffMode === 'inline' ? 'bg-accent' : 'hover:bg-accent'}`}
            title="Inline 模式"
          >
            <AlignLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setDiffMode('side-by-side')}
            className={`p-1 rounded ${diffMode === 'side-by-side' ? 'bg-accent' : 'hover:bg-accent'}`}
            title="并排对比模式"
          >
            <Columns2 className="h-4 w-4" />
          </button>
          <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
        </div>
      </div>

      {/* Version selector */}
      <div className="flex items-center gap-2 mb-3">
        <select
          value={leftVer}
          onChange={(e) => setLeftVer(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.version} - {formatDate(v.createdAt)}
            </option>
          ))}
        </select>

        <button onClick={handleSwap} className="p-1.5 rounded-md border border-input hover:bg-accent transition-colors active:scale-[0.95]" title="交换版本">
          <ArrowLeftRight className="h-4 w-4" />
        </button>

        <select
          value={rightVer}
          onChange={(e) => setRightVer(e.target.value)}
          className="flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          {versions.map((v) => (
            <option key={v.id} value={v.id}>
              {v.version} - {formatDate(v.createdAt)}
            </option>
          ))}
        </select>
      </div>

      {/* Diff view */}
      <ScrollArea className="flex-1 rounded border bg-muted/30">
        {diffMode === 'side-by-side' ? (
          <div className="flex">
            <div className="flex-1 border-r p-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {left?.version}（旧）
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {left?.content}
              </pre>
            </div>
            <div className="flex-1 p-2">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {right?.version}（新）
              </div>
              <pre className="text-xs font-mono whitespace-pre-wrap">
                {right?.content}
              </pre>
            </div>
          </div>
        ) : (
          <div className="p-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              {left?.version} → {right?.version}
            </div>
            <pre className="text-xs font-mono whitespace-pre-wrap">
              {lineDiffs.map((line, i) => {
                let className = '';
                if (line.type === 'insert') className = 'bg-green-100 dark:bg-green-950';
                if (line.type === 'delete') className = 'bg-red-100 dark:bg-red-950';
                if (line.text === '\n') return <br key={i} />;
                return (
                  <span key={i} className={className}>
                    {line.type === 'insert' ? '+' : line.type === 'delete' ? '-' : ' '}
                    {line.text}
                    {'\n'}
                  </span>
                );
              })}
            </pre>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
