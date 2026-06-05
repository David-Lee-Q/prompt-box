import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '@/components/layout/Header';
import MainContent from '@/components/layout/MainContent';
import StatusBar from '@/components/layout/StatusBar';
import PromptEditor from '@/components/prompt/PromptEditor';
import VersionList from '@/components/version/VersionList';
import VersionDiff from '@/components/version/VersionDiff';
import { getPrompt } from '@/services/promptService';
import { rollbackToVersion, deleteVersion, toggleVersionProtection } from '@/services/versionService';
import { deletePrompt } from '@/services/promptService';
import { exportPrompt } from '@/utils/export-import';
import useAppStore from '@/store/useAppStore';
import type { Prompt } from '@/types';
import { toast } from '@/hooks/use-toast';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { Trash2, History, ArrowLeftRight, Copy, Upload } from 'lucide-react';
import { copyToClipboard } from '@/utils/clipboard';

export default function PromptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadPrompts } = useAppStore();
  const [searchParams] = useSearchParams();

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [diffWidth, setDiffWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);

  const isCreating = id === 'new';
  const createSceneId = isCreating ? searchParams.get('sceneId') : null;

  useEffect(() => {
    if (id && id !== 'new') {
      getPrompt(id).then((p) => {
        if (p) setPrompt(p);
      });
    }
  }, [id]);

  const handleBack = () => {
    navigate('/');
  };

  const handleSaved = async (newId?: string) => {
    if (newId) {
      navigate(`/prompts/${newId}`);
      return;
    }
    await loadPrompts();
    if (id && id !== 'new') {
      const updated = await getPrompt(id);
      if (updated) setPrompt(updated);
    }
  };

  const handleShowVersions = () => {
    setShowVersions(true);
    setShowDiff(false);
  };

  const handleShowDiff = () => {
    setShowDiff(true);
    setShowVersions(false);
  };

  const handleClosePanel = () => {
    setShowVersions(false);
    setShowDiff(false);
  };

  const handleRollback = async (versionId: string) => {
    if (!id) return;
    try {
      await rollbackToVersion(id, versionId);
      const updated = await getPrompt(id);
      if (updated) setPrompt(updated);
      await loadPrompts();
      toast({ title: '回滚成功', description: '已回滚到所选版本', variant: 'success' });
    } catch (err) {
      toast({ title: '回滚失败', variant: 'destructive', description: String(err) });
    }
  };

  const handleDeleteVersion = async (versionId: string) => {
    try {
      await deleteVersion(versionId);
      toast({ title: '删除成功' });
    } catch (err) {
      toast({ title: '删除失败', variant: 'destructive', description: String(err) });
    }
  };

  const handleToggleProtection = async (versionId: string, isProtected: boolean) => {
    try {
      await toggleVersionProtection(versionId, isProtected);
      toast({ title: isProtected ? '已保护此版本' : '已取消保护' });
    } catch (err) {
      toast({ title: '操作失败', variant: 'destructive', description: String(err) });
    }
  };

  const handleExportPrompt = useCallback(async () => {
    if (!id) return;
    try {
      await exportPrompt(id);
      toast({ title: '导出成功' });
    } catch (err) {
      toast({ title: '导出失败', variant: 'destructive', description: String(err) });
    }
  }, [id]);

  const handleCopy = useCallback(async () => {
    if (!prompt?.content) return;
    const ok = await copyToClipboard(prompt.content);
    toast({ title: ok ? '已复制到剪贴板' : '复制失败', variant: ok ? 'success' : 'destructive' });
  }, [prompt]);

  useKeyboardShortcuts({
    'Ctrl+E': handleCopy,
    'Escape': handleClosePanel,
    'Ctrl+D': () => document.getElementById('btn-delete-prompt')?.click(),
  });

  // Resize handler for diff panel
  const handleDiffResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const handleMouseMove = (e: MouseEvent) => {
      setDiffWidth((prev) => Math.max(320, Math.min(800, prev - e.movementX)));
    };
    const handleMouseUp = () => setIsResizing(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const handleDeletePrompt = async () => {
    if (!id || !prompt) return;
    if (!window.confirm(`确定要删除提示词「${prompt.name}」吗？所有版本历史将被永久删除。`)) return;
    try {
      await deletePrompt(id);
      toast({ title: '删除成功' });
      navigate('/');
    } catch (err) {
      toast({ title: '删除失败', variant: 'destructive', description: String(err) });
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <Header />

      <div className="flex flex-1 overflow-hidden">
        <MainContent>
          <div className="flex flex-col md:flex-row h-full gap-4">
            <div className="flex-1 flex flex-col min-w-0">
              <div className="flex items-center justify-end mb-2 gap-1 flex-wrap">
                  {prompt && (
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1 text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors active:scale-[0.95]"
                      title="复制内容 (Ctrl+E)"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      复制
                    </button>
                  )}
                  {id && id !== 'new' && (
                    <>
                      <button
                        onClick={handleExportPrompt}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors active:scale-[0.95]"
                        title="导出提示词"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        导出
                      </button>
                      <button
                        onClick={handleShowVersions}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors active:scale-[0.95] ${
                          showVersions ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                        }`}
                      >
                        <History className="h-3.5 w-3.5" />
                        版本历史
                      </button>
                      <button
                        onClick={handleShowDiff}
                        className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors active:scale-[0.95] ${
                          showDiff ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                        }`}
                      >
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                        版本对比
                      </button>
                      <button
                        id="btn-delete-prompt"
                        onClick={handleDeletePrompt}
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent/50 transition-colors active:scale-[0.95]"
                        title="删除提示词"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        删除
                      </button>
                    </>
                  )}
                </div>
              <PromptEditor
                prompt={prompt}
                sceneId={isCreating ? createSceneId : null}
                onBack={handleBack}
                onSaved={handleSaved}
              />
            </div>

            {showVersions && id && prompt && (
              <div className="w-full md:w-72 border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 mt-4 md:mt-0 max-h-80 md:max-h-none">
                <VersionList
                  promptId={id}
                  currentVersionId={prompt.currentVersionId}
                  onRollback={handleRollback}
                  onDelete={handleDeleteVersion}
                  onToggleProtection={handleToggleProtection}
                  onClose={handleClosePanel}
                />
              </div>
            )}

            {showDiff && id && (
              <div className="relative border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 mt-4 md:mt-0 max-w-full group"
                style={{ width: diffWidth }}
              >
                {/* Drag handle */}
                <div
                  onMouseDown={handleDiffResizeStart}
                  className={`absolute left-0 top-0 bottom-0 w-1 z-10 cursor-col-resize hidden md:block transition-colors ${
                    isResizing ? 'bg-primary/50' : 'hover:bg-primary/30'
                  }`}
                >
                  <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-3.5 h-10 rounded-sm bg-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <svg width="3" height="14" viewBox="0 0 3 14" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground">
                      <line x1="1" y1="1" x2="1" y2="13" />
                      <line x1="2.5" y1="1" x2="2.5" y2="13" />
                    </svg>
                  </div>
                </div>
                <VersionDiff
                  promptId={id}
                  onClose={handleClosePanel}
                />
              </div>
            )}
          </div>
        </MainContent>
      </div>
      <StatusBar />
    </div>
  );
}
