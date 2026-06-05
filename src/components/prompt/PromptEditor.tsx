import { useState, useEffect, useRef } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Save, ArrowLeft, Hash, Clock } from 'lucide-react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import { savePrompt, updatePromptTags, updatePromptNotes, updatePromptScene, getAllTags } from '@/services/promptService';
import { getVersion } from '@/services/versionService';
import { toast } from '@/hooks/use-toast';
import { useTheme } from '@/hooks/use-theme';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import TagInput from '@/components/tag/TagInput';
import useAppStore from '@/store/useAppStore';
import { formatDate } from '@/utils/helpers';
import type { Prompt } from '@/types';

const DRAFT_KEY_PREFIX = 'prompt-draft-';
const AUTOSAVE_INTERVAL = 30000;

interface PromptEditorProps {
  prompt: Prompt | null;
  sceneId?: string | null;
  onBack: () => void;
  onSaved: (id?: string) => void;
}

export default function PromptEditor({ prompt, sceneId, onBack, onSaved }: PromptEditorProps) {
  const scenes = useAppStore((s) => s.scenes);
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
  const { resolvedTheme } = useTheme();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draftKey = prompt?.id ? `${DRAFT_KEY_PREFIX}${prompt.id}` : null;

  // Load prompt data or draft, initialize empty form for create mode
  useEffect(() => {
    if (prompt) {
      const saved = draftKey ? localStorage.getItem(draftKey) : null;
      if (saved) {
        try {
          const draft = JSON.parse(saved);
          setName(draft.name ?? prompt.name);
          setContent(draft.content ?? prompt.content);
        } catch {
          setName(prompt.name);
          setContent(prompt.content);
        }
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
        });
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
    getAllTags().then(setAllTags);
  }, [prompt, sceneId]);

  // Save draft to localStorage
  const saveDraft = useRef(() => {});
  saveDraft.current = () => {
    if (!draftKey) return;
    const currentName = name;
    const currentContent = content;
    if (currentContent !== prompt?.content || currentName !== prompt?.name) {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ name: currentName, content: currentContent })
      );
    }
  };

  // Auto-save draft every 30s (not in create mode)
  useEffect(() => {
    if (!draftKey) return;
    timerRef.current = setInterval(() => {
      saveDraft.current();
    }, AUTOSAVE_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [draftKey]);

  // Save draft on page close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => saveDraft.current();
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const handleSave = async () => {
    const finalName = name.trim() || '未命名提示词';
    const targetSceneId = prompt?.sceneId || createSceneId;
    if (!targetSceneId) return;
    setIsSaving(true);
    try {
      const result = await savePrompt(
        prompt?.id
          ? { id: prompt.id, sceneId: prompt.sceneId, name: finalName, content }
          : { sceneId: targetSceneId, name: finalName, content },
        changeLog || '更新内容'
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
      await updatePromptTags(prompt.id, newTags);
      getAllTags().then(setAllTags);
    }
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(async () => {
      if (prompt?.id) {
        await updatePromptNotes(prompt.id, val);
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

  useKeyboardShortcuts({
    'Ctrl+S': handleSave,
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
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={onBack} title="返回">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-lg font-bold border-0 bg-transparent focus-visible:ring-0 px-0"
          placeholder="提示词名称"
        />
        <div className="flex items-center gap-2 ml-auto">
          <Button size="sm" onClick={handleSave} disabled={isSaving}>
            <Save className="h-4 w-4 mr-1" />
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </div>
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
        <div className="flex items-center gap-1.5 ml-auto">
          <Label className="text-xs text-muted-foreground whitespace-nowrap">场景：</Label>
          <div className="relative">
            <select
              value={prompt ? prompt.sceneId : (createSceneId ?? '')}
              onChange={(e) => {
                if (prompt?.id) {
                  handleSceneChange(e.target.value);
                } else {
                  setCreateSceneId(e.target.value);
                }
              }}
              className="rounded-md border border-input bg-background pl-2.5 pr-7 py-1.5 text-xs appearance-none cursor-pointer hover:border-muted-foreground/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
            >
              {scenes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <svg
              className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-4">
        <div className="space-y-2">
          <Label>提示词内容</Label>
          <div className="border rounded-md overflow-hidden bg-background">
            <CodeMirror
              value={content}
              onChange={(val) => setContent(val)}
              extensions={[markdown(), json()]}
              height="300px"
              placeholder="在此输入提示词内容..."
              theme={resolvedTheme === 'dark' ? oneDark : undefined}
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                highlightActiveLine: true,
                autocompletion: false,
              }}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>标签</Label>
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
      </div>
    </div>
  );
}
