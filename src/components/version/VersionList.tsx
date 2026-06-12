import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDate } from '@/utils/helpers';
import { getVersionsByPrompt } from '@/services/versionService';
import StarRating from '@/components/ai/StarRating';
import type { Version } from '@/types';
import { Shield, ShieldOff, RotateCcw, Trash2, Clock } from 'lucide-react';

interface VersionListProps {
  promptId: string;
  currentVersionId: string;
  selectedVersionId: string | null;
  onSelect: (version: Version) => void;
  onRollback: (versionId: string) => Promise<void>;
  onDelete: (versionId: string) => Promise<void>;
  onToggleProtection: (versionId: string, isProtected: boolean) => Promise<void>;
  onClose: () => void;
}

export default function VersionList({
  promptId,
  currentVersionId,
  selectedVersionId,
  onSelect,
  onRollback,
  onDelete,
  onToggleProtection,
  onClose,
}: VersionListProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadVersions = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getVersionsByPrompt(promptId);
      setVersions(data);
    } catch {
      setError('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadVersions();
  }, [promptId]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm flex items-center gap-2">
          <Clock className="h-4 w-4" />
          版本历史
        </h3>
        <Button variant="ghost" size="sm" onClick={onClose}>
          关闭
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {error ? (
          <div className="text-center py-8">
            <p className="text-sm text-destructive mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={loadVersions}>重试</Button>
          </div>
        ) : loading ? (
          <p className="text-sm text-muted-foreground text-center py-8">加载中...</p>
        ) : versions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">暂无版本记录</p>
        ) : (
          <div className="space-y-2">
            {versions.map((v) => {
              const isCurrent = v.id === currentVersionId;
              return (
                <div
                  key={v.id}
                  onClick={() => onSelect(v)}
                  className={`p-3 rounded-lg border text-sm cursor-pointer transition-colors ${
                    v.id === selectedVersionId
                      ? 'border-primary/70 bg-primary/10 ring-1 ring-primary/30'
                      : isCurrent
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:bg-accent/50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{v.version}</span>
                      {v.score != null && (
                        <StarRating value={v.score} readonly size="sm" />
                      )}
                      {isCurrent && (
                        <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded">
                          当前
                        </span>
                      )}
                      {v.isInitial && (
                        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          初始
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(v.createdAt)}</span>
                  </div>

                  {v.title && <p className="text-xs text-muted-foreground mb-1">{v.title}</p>}
                  {v.changeLog && (
                    <p className="text-xs text-muted-foreground/80 mb-2">{v.changeLog}</p>
                  )}

                  {!isCurrent && (
                    <div className="flex items-center gap-1 mt-2 pt-2 border-t border-border">
                      <button
                        onClick={async () => { await onRollback(v.id); await loadVersions(); }}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-primary/10 text-primary hover:bg-primary/20 transition-colors active:scale-[0.95]"
                        title="回滚到此版本"
                      >
                        <RotateCcw className="h-3 w-3" />
                        回滚
                      </button>
                      <button
                        onClick={async () => { await onToggleProtection(v.id, !v.isProtected); await loadVersions(); }}
                        className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-accent text-muted-foreground hover:text-foreground transition-colors active:scale-[0.95]"
                        title={v.isProtected ? '取消保护' : '保护此版本'}
                      >
                        {v.isProtected ? (
                          <ShieldOff className="h-3 w-3" />
                        ) : (
                          <Shield className="h-3 w-3" />
                        )}
                        {v.isProtected ? '取消保护' : '保护'}
                      </button>
                      {!v.isInitial && (
                        <button
                          onClick={async () => { await onDelete(v.id); await loadVersions(); }}
                          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-accent text-muted-foreground hover:text-destructive transition-colors active:scale-[0.95]"
                          title="删除版本"
                        >
                          <Trash2 className="h-3 w-3" />
                          删除
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
