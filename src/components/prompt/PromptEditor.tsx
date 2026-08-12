import { useState, useEffect, useRef, useMemo } from 'react';
import DOMPurify from 'dompurify';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save, ArrowLeft, Hash, Clock, Sparkles, Eye } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView, keymap } from '@codemirror/view';
import { indentMore, indentLess } from '@codemirror/commands';
import { indentUnit } from '@codemirror/language';
import { savePrompt, updatePromptTags, updatePromptNotes, updatePromptScene, getAllTags } from '@/services/promptService';
import { getVersion } from '@/services/versionService';
import { toast } from '@/hooks/use-toast';
import { useTheme } from '@/hooks/use-theme';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useVariables } from '@/hooks/useVariables';
import TagInput from '@/components/tag/TagInput';
import VariableForm from '@/components/ai/VariableForm';
import OptimizePanel from '@/components/ai/OptimizePanel';
import GenerateDialog from '@/components/ai/GenerateDialog';
import TagRecommendation from '@/components/ai/TagRecommendation';
import type { TagSuggestion } from '@/services/tagSuggest';
import useAppStore from '@/store/useAppStore';
import { getSessionUser } from '@/store/authStore';
import useSettingsStore from '@/store/settingsStore';
import { formatDate } from '@/utils/helpers';
import { copyToClipboard } from '@/utils/clipboard';
import type { Prompt } from '@/types';

const DRAFT_KEY_PREFIX = 'prompt-draft-';
const AUTOSAVE_INTERVAL = 30000;

interface PromptEditorProps {
  prompt: Prompt | null;
  sceneId?: string | null;
  onBack: () => void;
  onSaved: (id?: string) => void;
  toolbarActions?: React.ReactNode;
  readOnly?: boolean;
  readOnlyContent?: string;
  readOnlyTitle?: string;
  readOnlyChangeLog?: string;
  onBackToCurrent?: () => void;
  tagSuggestions?: TagSuggestion[] | null;
  onDismissTags?: () => void;
  previewFormat?: 'markdown' | 'html';
  onFormatChange?: (format: 'markdown' | 'html') => void;
}

export default function PromptEditor({ prompt, sceneId, onBack, onSaved, toolbarActions, readOnly, readOnlyContent, readOnlyTitle, readOnlyChangeLog, onBackToCurrent, tagSuggestions, onDismissTags, previewFormat = 'markdown', onFormatChange }: PromptEditorProps) {
  const scenes = useAppStore((s) => s.scenes);
  const sessionUser = getSessionUser();
  const userId = sessionUser?.id ?? '';
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [changeLog, setChangeLog] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updatedDate, setUpdatedDate] = useState<number>(0);
  const [createSceneId, setCreateSceneId] = useState<string | null>(null);
  const [showOptimize, setShowOptimize] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  // Custom Tab keybinding: indent at line start / selection; insert spaces at cursor otherwise
  const smartTab = useMemo(() => ({
    key: 'Tab',
    run: ({ state, dispatch }: { state: any; dispatch: any }) => {
      if (state.readOnly) return false;
      // If there's a selection, use standard indentMore (handles multi-line)
      const hasSelection = state.selection.ranges.some((r: any) => !r.empty);
      if (hasSelection) return indentMore({ state, dispatch });
      // Single cursor: check if we're at the start of the line (only whitespace before)
      const range = state.selection.main;
      const line = state.doc.lineAt(range.from);
      const beforeCursor = line.text.slice(0, range.from - line.from);
      if (/^\s*$/.test(beforeCursor)) {
        // At line start (or only whitespace): indent the line
        dispatch(state.update({
          changes: { from: line.from, insert: state.facet(indentUnit) },
          selection: { anchor: range.from + state.facet(indentUnit).length },
        }, { userEvent: 'input.indent', scrollIntoView: true }));
        return true;
      }
      // Cursor in middle/end of text: insert at cursor position
      dispatch(state.update({
        changes: { from: range.from, insert: state.facet(indentUnit) },
        selection: { anchor: range.from + state.facet(indentUnit).length },
      }, { userEvent: 'input.indent', scrollIntoView: true }));
      return true;
    },
    shift: indentLess,
    preventDefault: true,
  }), []);

  const { resolvedTheme } = useTheme();
  const { isConfigured } = useSettingsStore();
  const { hasVariables } = useVariables(content);
  const [editorHeight, setEditorHeight] = useState(300);
  const [isResizingEditor, setIsResizingEditor] = useState(false);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const fn = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  const isReadyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draftKey = prompt?.id ? `${DRAFT_KEY_PREFIX}${prompt.id}` : null;

  // Load prompt data or draft, initialize empty form for create mode
  useEffect(() => {
    if (prompt) {
      const saved = draftKey ? localStorage.getItem(draftKey) : null;
      const draft = saved ? (() => { try { return JSON.parse(saved); } catch { return null; } })() : null;
      // Treat empty draft as no draft (both name and content empty)
      if (draft && (draft.content || draft.name)) {
        setName(draft.name || prompt.name);
        setContent(draft.content || prompt.content);
        // Clean up the stale empty draft so next load is fast
        if (!draft.content && draftKey) localStorage.removeItem(draftKey);
      } else {
        setName(prompt.name);
        setContent(prompt.content);
      }
      setTags(prompt.tags ?? []);
      setNotes(prompt.notes ?? '');
      setChangeLog('');
      setUpdatedDate(prompt.updatedAt);

      // 获取当前版本号
      if (prompt.currentVersionId) {
        getVersion(prompt.currentVersionId).then((v) => {
          if (v) setCurrentVersion(v.version);
        }).catch(() => {});
      }
    } else if (!sceneId) {
      // Neither prompt nor creating — reset to defaults
      setName('');
      setContent('');
      setTags([]);
      setNotes('');
      setChangeLog('');
      setCurrentVersion('');
      setUpdatedDate(0);
    }
    if (sceneId) setCreateSceneId(sceneId);
    if (userId) {
      getAllTags(userId).then(setAllTags).catch(() => {});
    }
    // Only mark ready once content is actually initialized (prompt loaded or in create mode)
    if (prompt || sceneId) isReadyRef.current = true;
  }, [prompt, sceneId]);

  // Set content from readOnlyContent when in readonly mode
  useEffect(() => {
    if (readOnly && readOnlyContent !== undefined) {
      setContent(readOnlyContent);
    } else if (!readOnly && prompt) {
      setContent(prompt.content);
    }
  }, [readOnly, readOnlyContent]);

  // Save draft to localStorage
  const saveDraft = useRef(() => {});
  saveDraft.current = () => {
    if (readOnly || !draftKey || !isReadyRef.current) return;
    const currentName = name;
    const currentContent = content;
    if (currentContent !== prompt!.content || currentName !== prompt!.name) {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ name: currentName, content: currentContent })
      );
    }
  };

  // Auto-save draft every 30s (not in create mode, not in readonly mode)
  useEffect(() => {
    if (readOnly || !draftKey) return;
    timerRef.current = setInterval(() => {
      saveDraft.current();
    }, AUTOSAVE_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [readOnly, draftKey]);

  // Save draft on unmount (SPA navigation — beforeunload does NOT fire)
  useEffect(() => {
    return () => {
      saveDraft.current();
    };
  }, [readOnly, draftKey]);

  // Save draft on page close/refresh (skipped in readonly mode)
  useEffect(() => {
    if (readOnly) return;
    const handleBeforeUnload = () => saveDraft.current();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [readOnly]);

  const handleSave = async () => {
    if (readOnly) return;
    const finalName = name.trim() || '未命名提示词';
    const targetSceneId = prompt?.sceneId || createSceneId;
    if (!targetSceneId) return;
    setIsSaving(true);
    try {
      const result = await savePrompt(
        prompt?.id
          ? { id: prompt.id, sceneId: prompt.sceneId, name: finalName, content }
          : { sceneId: targetSceneId, name: finalName, content },
        changeLog || '更新内容',
        userId ?? ''
      );
      toast({ title: '保存成功', variant: 'success' });
      setChangeLog('');
      if (draftKey) localStorage.removeItem(draftKey);
      const createdId = prompt?.id ? undefined : (result as Prompt)?.id;
      onSaved(createdId);
    } catch (err) {
      toast({ title: '保存失败', variant: 'destructive', description: String(err) });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTagsChange = async (newTags: string[]) => {
    setTags(newTags);
    if (prompt?.id) {
      try {
        await updatePromptTags(prompt.id, newTags);
        if (userId) getAllTags(userId).then(setAllTags).catch(() => {});
      } catch {}
    }
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(async () => {
      if (prompt?.id) {
        try {
          await updatePromptNotes(prompt.id, val);
        } catch {}
      }
    }, 500);
  };

  const handleSceneChange = async (sceneId: string) => {
    if (!prompt?.id) return;
    try {
      await updatePromptScene(prompt.id, sceneId);
      toast({ title: '场景已更新', variant: 'success' });
      onSaved();
    } catch (err) {
      toast({ title: '更新失败', variant: 'destructive', description: String(err) });
    }
  };

  // Editor resize handler
  useEffect(() => {
    if (!isResizingEditor) return;
    const handleMouseMove = (e: MouseEvent) => {
      setEditorHeight((prev) => Math.max(120, Math.min(1200, prev + e.movementY)));
    };
    const handleMouseUp = () => setIsResizingEditor(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingEditor]);

  useKeyboardShortcuts(readOnly ? {} : {
    'Ctrl+S': handleSave,
    'Ctrl+I': () => { if (content && isConfigured) setShowOptimize(true); },
  });

  if (!prompt && !sceneId) {
    return (
      <div className="flex items-center justify-center h-60 text-muted-foreground">
        选择提示词以开始编辑
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {readOnly && (
        <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-md bg-primary/5 border border-primary/20 text-sm">
          <span className="text-muted-foreground">正在浏览版本</span>
          <span className="font-mono font-medium text-primary">{readOnlyTitle}</span>
          {readOnlyChangeLog && (
            <span className="text-muted-foreground max-w-xs truncate" title={readOnlyChangeLog}>— {readOnlyChangeLog}</span>
          )}
          <span className="text-muted-foreground">— 只读模式</span>
          {onBackToCurrent && (
            <button
              onClick={onBackToCurrent}
              className="ml-auto text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              返回当前版本
            </button>
          )}
        </div>
      )}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={onBack} title="返回" className="flex-shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          readOnly={readOnly}
          className="text-lg font-bold border-0 bg-transparent focus-visible:ring-0 px-0 min-w-[120px] flex-1"
          placeholder="提示词名称"
        />
        {!readOnly && (
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {content && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowOptimize(true)}
                disabled={!isConfigured}
                title={isConfigured ? 'AI 优化 (Ctrl+I)' : '需要先配置 API Key'}
              >
                <Sparkles className="h-3.5 w-3.5 mr-1" />
                AI 优化
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowGenerate(true)}
              disabled={!isConfigured}
              title={isConfigured ? 'AI 生成' : '需要先配置 API Key'}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              AI生成
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? '保存中...' : '保存'}
            </Button>
          </div>
        )}
      </div>

      {/* 版本信息 + 场景选择 */}
      <div className="flex items-center gap-4 mb-4 text-xs text-muted-foreground flex-wrap">
        {currentVersion && (
          <span className="flex items-center gap-1">
            <Hash className="h-3 w-3" />
            <span className="font-mono text-primary/70 font-medium">{currentVersion}</span>
          </span>
        )}
        {updatedDate > 0 && (
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatDate(updatedDate)}</span>
          </span>
        )}
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0">
        {/* 左侧：内容编辑区（2/3） */}
        <div className="flex-[2] min-w-0 flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="font-bold">提示词内容</Label>
            <div className="flex items-center gap-1">
              {onFormatChange && (
                <button
                  onClick={() => onFormatChange(previewFormat === 'markdown' ? 'html' : 'markdown')}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors active:scale-[0.95] ${previewFormat === 'html' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'}`}
                  title="切换预览格式"
                >
                  <Eye className="h-3 w-3" />
                  {previewFormat === 'markdown' ? 'Markdown' : 'HTML'}
                </button>
              )}
              {toolbarActions}
            </div>
          </div>
          <div className="flex-1 min-h-0 border rounded-md overflow-hidden bg-background">
            {previewFormat === 'html' ? (
              <div className="prose prose-sm dark:prose-invert max-w-none p-4 overflow-y-auto h-full" style={isDesktop ? undefined : { minHeight: `${editorHeight}px`, maxHeight: `${editorHeight}px` }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                  {DOMPurify.sanitize(content || readOnlyContent || '')}
                </ReactMarkdown>
              </div>
            ) : (
              <CodeMirror
                key={resolvedTheme}
                style={{ fontSize: '14px', height: isDesktop ? '100%' : `${editorHeight}px` }}
                value={content}
                onChange={(val) => setContent(val)}
                readOnly={readOnly}
                extensions={[markdown(), json(), EditorView.lineWrapping, keymap.of([smartTab])]}
                height={isDesktop ? '100%' : `${editorHeight}px`}
                placeholder="在此输入提示词内容..."
                theme={resolvedTheme === 'dark' ? oneDark : undefined}
                indentWithTab={false}
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: false,
                  highlightActiveLine: !readOnly,
                  autocompletion: false,
                }}
              />
            )}
            {!readOnly && !isDesktop && (
              <div
                onMouseDown={(e) => { e.preventDefault(); setIsResizingEditor(true); }}
                className="h-2 cursor-row-resize bg-transparent hover:bg-primary/20 transition-colors rounded-b-md"
                title="拖动调整编辑框高度"
              />
            )}
          </div>
        </div>

        {/* 右侧：配置字段区（1/3） */}
        <div className="flex-1 min-w-0 flex flex-col gap-4 overflow-y-auto pb-1">
          {readOnly && readOnlyChangeLog && (
            <div className="space-y-1.5">
              <Label className="text-muted-foreground">更新说明</Label>
              <p className="text-sm text-muted-foreground bg-muted/30 rounded-md p-3">{readOnlyChangeLog}</p>
            </div>
          )}

          {!readOnly && (
            <>
              <div className="space-y-1.5">
                <Label>所属场景</Label>
                <select
                  value={prompt ? prompt.sceneId : (createSceneId ?? '')}
                  onChange={(e) => {
                    if (prompt?.id) {
                      handleSceneChange(e.target.value);
                    } else {
                      setCreateSceneId(e.target.value);
                    }
                  }}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {scenes.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {!readOnly && hasVariables && (
            <VariableForm
              template={content}
              onCopy={async (rendered) => {
                const ok = await copyToClipboard(rendered);
                toast({ title: ok ? '已复制到剪贴板' : '复制失败', variant: ok ? 'success' : 'destructive' });
              }}
            />
          )}

          {showOptimize && (
            <OptimizePanel
              key={content}
              content={content}
              onApply={(optimized) => {
                setContent(optimized);
                setShowOptimize(false);
              }}
              onClose={() => setShowOptimize(false)}
            />
          )}

          {!readOnly && (
            <>
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Label>标签</Label>
                  {tagSuggestions && (
                    <TagRecommendation
                      suggestions={tagSuggestions}
                      onApply={async (selectedTags) => {
                        const newTags = [...tags, ...selectedTags.filter((t) => !tags.includes(t))];
                        setTags(newTags);
                        if (prompt?.id) {
                          await updatePromptTags(prompt.id, newTags);
              getAllTags(userId).then(setAllTags);
                        }
                        onDismissTags?.();
                      }}
                      onDismiss={() => onDismissTags?.()}
                    />
                  )}
                </div>
                <TagInput
                  tags={tags}
                  suggestions={allTags}
                  onChange={handleTagsChange}
                />
              </div>

              <div className="space-y-2">
                <Label>备注</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => handleNotesChange(e.target.value)}
                  className="min-h-[80px] text-sm"
                  placeholder="添加备注说明..."
                />
              </div>

              <div className="space-y-2">
                <Label>更新说明（可选）</Label>
                <Input
                  value={changeLog}
                  onChange={(e) => setChangeLog(e.target.value)}
                  placeholder="描述本次更新的内容..."
                />
              </div>
            </>
          )}
        </div>
      </div>

      <GenerateDialog
        open={showGenerate}
        onOpenChange={setShowGenerate}
        onAdopt={(generatedContent, title) => {
          setName(title);
          setContent(generatedContent);
        }}
      />
    </div>
  );
}
