import { useState, useRef, useEffect } from 'react';
import { Sparkles, Loader2, Check, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { generateCandidates, parseCandidates } from '@/services/ai';
import useSettingsStore from '@/store/settingsStore';

interface GenerateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdopt: (content: string, title: string) => void;
}

export default function GenerateDialog({
  open,
  onOpenChange,
  onAdopt,
}: GenerateDialogProps) {
  const { isConfigured, setShowSettings } = useSettingsStore();
  const [description, setDescription] = useState('');
  const [candidates, setCandidates] = useState<{ id: string; content: string }[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (open) {
      setDescription('');
      setCandidates([]);
      setError(null);
      setEditingId(null);
    }
  }, [open]);

  const handleGenerate = async () => {
    if (!description.trim()) return;
    setIsGenerating(true);
    setError(null);
    setCandidates([]);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const result = await generateCandidates(description, controller.signal);
      const parts = parseCandidates(result);
      setCandidates(
        parts.map((content, i) => ({
          id: `candidate-${i}`,
          content,
        }))
      );
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : '生成失败');
    } finally {
      setIsGenerating(false);
      abortRef.current = null;
    }
  };

  const handleAdopt = (content: string) => {
    const title = description.trim().slice(0, 30) + (description.length > 30 ? '...' : '');
    onAdopt(content, title || 'AI 生成提示词');
    onOpenChange(false);
  };

  const startEdit = (content: string) => {
    setEditText(content);
    setEditingId('edit');
  };

  const handleEditAdopt = () => {
    if (!editText.trim()) return;
    handleAdopt(editText.trim());
  };

  if (!isConfigured) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>AI 生成提示词</DialogTitle>
            <DialogDescription>需要配置 API Key 才能使用</DialogDescription>
          </DialogHeader>
          <Button variant="outline" onClick={() => { onOpenChange(false); setShowSettings(true); }}>
            前往设置
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            AI 生成提示词
          </DialogTitle>
          <DialogDescription>描述你需要的 Prompt，AI 将生成多个候选方案</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="例：我需要一个能帮我把技术文章摘要翻译成中文、保留代码块、输出 Markdown 格式的 Prompt..."
              className="min-h-[100px] text-sm"
              disabled={isGenerating}
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={!description.trim() || isGenerating}
            className="w-full"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                生成
              </>
            )}
          </Button>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {editingId === 'edit' && (
            <div className="space-y-2 rounded-lg border p-3">
              <Textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="min-h-[120px] text-sm font-mono"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEditAdopt}>
                  <Check className="h-3.5 w-3.5 mr-1" />
                  保存并采纳
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                  取消
                </Button>
              </div>
            </div>
          )}

          {candidates.length > 0 && !isGenerating && editingId !== 'edit' && (
            <div className="space-y-3">
              {candidates.map((c, i) => (
                <div key={c.id} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">
                      方案 {String.fromCharCode(65 + i)}{i === 0 ? '（推荐）' : ''}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(c.content)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        编辑
                      </Button>
                      <Button size="sm" onClick={() => handleAdopt(c.content)}>
                        <Check className="h-3.5 w-3.5 mr-1" />
                        采纳
                      </Button>
                    </div>
                  </div>
                  <pre className="text-sm whitespace-pre-wrap font-sans bg-muted/30 rounded p-2 max-h-40 overflow-y-auto">
                    {c.content}
                  </pre>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerate}
                className="w-full"
              >
                重新生成
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
