import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import Header from '@/components/layout/Header';
import MainContent from '@/components/layout/MainContent';
import StatusBar from '@/components/layout/StatusBar';
import PromptEditor from '@/components/prompt/PromptEditor';
import VersionList from '@/components/version/VersionList';
import VersionDiff from '@/components/version/VersionDiff';
import TestPanel from '@/components/ai/TestPanel';
import MultiModelTest from '@/components/ai/MultiModelTest';
import QualityAnalysisPanel from '@/components/ai/QualityAnalysisPanel';
import QualityAnalysisBadge from '@/components/ai/QualityAnalysisBadge';
import { analyzePrompt, type AnalysisReport } from '@/services/promptAnalyzer';
import { suggestTags } from '@/services/tagSuggest';
import type { TagSuggestion } from '@/services/tagSuggest';
import { getPrompt, getAllTags } from '@/services/promptService';
import { rollbackToVersion, deleteVersion, toggleVersionProtection } from '@/services/versionService';
import { deletePrompt } from '@/services/promptService';
import { exportPrompt } from '@/utils/export-import';
import useAppStore from '@/store/useAppStore';
import type { Prompt, Version } from '@/types';
import { toast } from '@/hooks/use-toast';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { Trash2, History, ArrowLeftRight, Copy, Upload, Play, Columns2, BarChart3, FileCode, Send } from 'lucide-react';
import AgentExportDialog from '@/components/ai/AgentExportDialog';
import InsertDialog from '@/components/insert/InsertDialog';
import { getAvailablePlatforms } from '@/services/insertService';
import { copyToClipboard } from '@/utils/clipboard';

function PanelDragHandle({ onMouseDown, isResizing }: { onMouseDown: (e: React.MouseEvent) => void; isResizing: boolean }) {
  return (
    <div onMouseDown={onMouseDown} className={`absolute left-0 top-0 bottom-0 w-1 z-10 cursor-col-resize hidden md:block transition-colors ${isResizing ? 'bg-primary/50' : 'hover:bg-primary/30'}`}>
      <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-3.5 h-10 rounded-sm bg-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <svg width="3" height="14" viewBox="0 0 3 14" fill="none" stroke="currentColor" strokeWidth="1" className="text-muted-foreground">
          <line x1="1" y1="1" x2="1" y2="13" /><line x1="2.5" y1="1" x2="2.5" y2="13" />
        </svg>
      </div>
    </div>
  );
}

export default function PromptDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { loadPrompts } = useAppStore();
  const [searchParams] = useSearchParams();

  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [showTest, setShowTest] = useState(false);
  const [tagSuggestions, setTagSuggestions] = useState<TagSuggestion[] | null>(null);
  const [showMultiModel, setShowMultiModel] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showAgentExport, setShowAgentExport] = useState(false);
  const [showInsert, setShowInsert] = useState(false);
  const [analysisReport, setAnalysisReport] = useState<AnalysisReport | null>(null);
  const [viewingVersion, setViewingVersion] = useState<Version | null>(null);
  const [panelWidth, setPanelWidth] = useState(480);
  const [isResizing, setIsResizing] = useState(false);

  const isCreating = id === 'new';
  const createSceneId = isCreating ? searchParams.get('sceneId') : null;

  useEffect(() => {
    if (id && id !== 'new') {
      getPrompt(id).then((p) => {
        if (p) {
          setPrompt(p);
          if (p.tags.length < 3 && p.content.length >= 50) {
            getAllTags().then((allTags) => {
              const suggestions = suggestTags(p.content, p.tags, allTags);
              if (suggestions.length > 0) setTagSuggestions(suggestions);
            });
          }
        }
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
    setShowTest(false);
    setShowMultiModel(false);
    setShowAnalysis(false);
  };

  const handleShowDiff = () => {
    setShowDiff(true);
    setShowVersions(false);
    setShowTest(false);
    setShowMultiModel(false);
    setShowAnalysis(false);
  };

  const handleClosePanel = () => {
    setShowVersions(false);
    setShowDiff(false);
    setShowTest(false);
    setShowMultiModel(false);
    setShowAnalysis(false);
    setViewingVersion(null);
  };

  const handleRollback = async (versionId: string) => {
    if (!id) return;
    try {
      await rollbackToVersion(id, versionId);
      setViewingVersion(null);
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
      if (viewingVersion?.id === versionId) setViewingVersion(null);
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
      setPanelWidth((prev) => Math.max(320, Math.min(800, prev - e.movementX)));
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
                      <button onClick={handleExportPrompt} className="flex items-center gap-1 text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors active:scale-[0.95]" title="导出提示词">
                        <Upload className="h-3.5 w-3.5" />导出
                      </button>
                      <button onClick={() => setShowAgentExport(true)} className="flex items-center gap-1 text-xs px-2 py-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors active:scale-[0.95]" title="导出为 Agent 工具配置">
                        <FileCode className="h-3.5 w-3.5" />导出工具
                      </button>
                      {getAvailablePlatforms().length > 0 && (
                        <button onClick={() => setShowInsert(true)} className="flex items-center gap-1 text-xs px-2 py-1 rounded text-primary hover:bg-primary/10 transition-colors active:scale-[0.95]" title="一键插入到 AI 平台">
                          <Send className="h-3.5 w-3.5" />插入
                        </button>
                      )}
                      <button onClick={handleShowVersions} className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors active:scale-[0.95] ${showVersions ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}>
                        <History className="h-3.5 w-3.5" />版本历史
                      </button>
                      <button onClick={handleShowDiff} className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors active:scale-[0.95] ${showDiff ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}>
                        <ArrowLeftRight className="h-3.5 w-3.5" />版本对比
                      </button>
                      <button id="btn-delete-prompt" onClick={handleDeletePrompt} className="flex items-center gap-1 text-xs px-2 py-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent/50 transition-colors active:scale-[0.95]" title="删除提示词">
                        <Trash2 className="h-3.5 w-3.5" />删除
                      </button>
                    </>
                  )}
                </div>
              <PromptEditor
                prompt={prompt}
                sceneId={isCreating ? createSceneId : null}
                tagSuggestions={tagSuggestions}
                onDismissTags={() => setTagSuggestions(null)}
                onBack={handleBack}
                onSaved={handleSaved}
                readOnly={!!viewingVersion}
                readOnlyContent={viewingVersion?.content}
                readOnlyTitle={viewingVersion?.version}
                onBackToCurrent={() => setViewingVersion(null)}
                toolbarActions={id && id !== 'new' ? (
                  <>
                    <button
                      onClick={() => { setShowAnalysis(true); setShowTest(false); setShowVersions(false); setShowDiff(false); setShowMultiModel(false); console.log('[QA] tab clicked, prompt:', !!prompt, 'content:', prompt?.content?.length ?? 0); if (prompt?.content) {
                        const r = analyzePrompt(prompt.content);
                        console.log('[QA] tab open:', prompt.content.length + 'chars', 'weighted=' + r.overall.weighted);
                        setAnalysisReport(r);
                      }}}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors active:scale-[0.95] ${showAnalysis ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
                      title="质量分析"
                    >
                      <BarChart3 className="h-3.5 w-3.5" />
                      质量分析
                      <QualityAnalysisBadge score={analysisReport?.overall.weighted} />
                    </button>
                    <button
                      onClick={() => { setShowTest(true); setShowVersions(false); setShowDiff(false); setShowMultiModel(false); setShowAnalysis(false); }}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors active:scale-[0.95] ${showTest ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
                      title="运行测试"
                    >
                      <Play className="h-3.5 w-3.5" />
                      运行测试
                    </button>
                    <button
                      onClick={() => { setShowMultiModel(true); setShowTest(false); setShowVersions(false); setShowDiff(false); setShowAnalysis(false); }}
                      className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors active:scale-[0.95] ${showMultiModel ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
                      title="模型对比"
                    >
                      <Columns2 className="h-3.5 w-3.5" />
                      模型对比
                    </button>
                  </>
                ) : undefined}
              />
            </div>

            {showVersions && id && prompt && (
              <div className="relative border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 mt-4 md:mt-0 overflow-y-auto group" style={{ width: panelWidth, maxHeight: 'calc(100vh - 120px)' }}>
                <PanelDragHandle onMouseDown={handleDiffResizeStart} isResizing={isResizing} />
                <VersionList
                  promptId={id}
                  currentVersionId={prompt.currentVersionId}
                  selectedVersionId={viewingVersion?.id ?? null}
                  onSelect={(v) => setViewingVersion(v)}
                  onRollback={handleRollback}
                  onDelete={handleDeleteVersion}
                  onToggleProtection={handleToggleProtection}
                  onClose={handleClosePanel}
                />
              </div>
            )}

            {showDiff && id && (
              <div className="relative border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 mt-4 md:mt-0 max-w-full group" style={{ width: panelWidth }}>
                <PanelDragHandle onMouseDown={handleDiffResizeStart} isResizing={isResizing} />
                <VersionDiff
                  promptId={id}
                  onClose={handleClosePanel}
                />
              </div>
            )}

            {showTest && id && prompt && (
              <div className="relative border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 mt-4 md:mt-0 overflow-y-auto group" style={{ width: panelWidth, maxHeight: 'calc(100vh - 120px)' }}>
                <PanelDragHandle onMouseDown={handleDiffResizeStart} isResizing={isResizing} />
                <TestPanel
                  versionId={prompt.currentVersionId}
                  content={prompt.content}
                  onClose={() => setShowTest(false)}
                />
              </div>
            )}

            {showMultiModel && id && prompt && (
              <div className="relative border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 mt-4 md:mt-0 overflow-y-auto group" style={{ width: panelWidth, maxHeight: 'calc(100vh - 120px)' }}>
                <PanelDragHandle onMouseDown={handleDiffResizeStart} isResizing={isResizing} />
                <MultiModelTest
                  content={prompt.content}
                  onClose={() => setShowMultiModel(false)}
                />
              </div>
            )}

            {showAnalysis && id && prompt && (
              <div className="relative border-t md:border-t-0 md:border-l pt-4 md:pt-0 md:pl-4 mt-4 md:mt-0 overflow-y-auto group" style={{ width: panelWidth, maxHeight: 'calc(100vh - 120px)' }}>
                <PanelDragHandle onMouseDown={handleDiffResizeStart} isResizing={isResizing} />
                <QualityAnalysisPanel
                  report={analysisReport}
                  onRefresh={() => {
                    console.log('[QA] refresh clicked, prompt:', !!prompt, 'content:', prompt?.content?.length ?? 0);
                    if (prompt?.content) {
                      const r = analyzePrompt(prompt.content);
                      console.log('[QA] refresh done: weighted=' + r.overall.weighted);
                      setAnalysisReport(r);
                    }
                  }}
                  onClose={() => setShowAnalysis(false)}
                />
              </div>
            )}
          </div>
        </MainContent>
      </div>
      {prompt && (
        <AgentExportDialog
          open={showAgentExport}
          onOpenChange={setShowAgentExport}
          prompt={prompt}
          version={viewingVersion ?? undefined}
        />
      )}
      {prompt && (
        <InsertDialog
          open={showInsert}
          onOpenChange={setShowInsert}
          content={prompt.content}
          title={prompt.name}
        />
      )}
      <StatusBar />
    </div>
  );
}
