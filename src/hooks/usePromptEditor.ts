import { useState, useEffect, useRef } from 'react';
import { savePrompt, updatePromptNotes, getAllTags } from '@/services/promptService';
import { getVersion } from '@/services/versionService';
import { toast } from '@/hooks/use-toast';
import { useVariables } from '@/hooks/useVariables';
import type { Prompt } from '@/types';
import { getSessionUser } from '@/store/authStore';

const DRAFT_KEY_PREFIX = 'prompt-draft-';
const AUTOSAVE_INTERVAL = 30000;

export interface PromptEditorState {
  name: string;
  content: string;
  tags: string[];
  notes: string;
  changeLog: string;
  isSaving: boolean;
  allTags: string[];
  currentVersion: string;
  updatedDate: number;
  showOptimize: boolean;
  showGenerate: boolean;
  hasVariables: boolean;
}

export function usePromptEditor(
  prompt: Prompt | null,
  sceneId: string | null | undefined,
  onSaved: (id?: string) => void
) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [changeLog, setChangeLog] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [updatedDate, setUpdatedDate] = useState<number>(0);
  const [showOptimize, setShowOptimize] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);

  const { hasVariables } = useVariables(content);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const draftKey = prompt?.id ? `${DRAFT_KEY_PREFIX}${prompt.id}` : null;

  useEffect(() => {
    const user = getSessionUser();
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

      if (prompt.currentVersionId) {
        getVersion(prompt.currentVersionId, user?.id).then((v) => {
          if (v) setCurrentVersion(v.version);
        }).catch(() => {});
      }
    } else if (!sceneId) {
      setName('');
      setContent('');
      setTags([]);
      setNotes('');
      setChangeLog('');
      setCurrentVersion('');
      setUpdatedDate(0);
    }
    if (user) {
      getAllTags(user.id).then(setAllTags).catch(() => {});
    }
  }, [prompt, sceneId, draftKey]);

  // Draft auto-save
  const saveDraft = useRef(() => {});
  saveDraft.current = () => {
    if (!draftKey) return;
    if (content !== prompt?.content || name !== prompt?.name) {
      localStorage.setItem(draftKey, JSON.stringify({ name, content }));
    }
  };

  useEffect(() => {
    if (!draftKey) return;
    timerRef.current = setInterval(() => saveDraft.current(), AUTOSAVE_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [draftKey]);

  useEffect(() => {
    const handler = () => saveDraft.current();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, []);

  const handleSave = async () => {
    const user = getSessionUser();
    if (!user) return;
    const finalName = name.trim() || '未命名提示词';
    const targetSceneId = prompt?.sceneId || sceneId;
    if (!targetSceneId) return;
    setIsSaving(true);
    try {
      const result = await savePrompt(
        prompt?.id
          ? { id: prompt.id, sceneId: prompt.sceneId, name: finalName, content }
          : { sceneId: targetSceneId, name: finalName, content },
        changeLog || '更新内容',
        user.id
      );
      toast({ title: '保存成功', variant: 'success' });
      setChangeLog('');
      if (draftKey) localStorage.removeItem(draftKey);

      const createdId = prompt?.id ? undefined : (result as Prompt)?.id;
      onSaved(createdId);
      return { result, content, currentTags: tags };
    } catch (err) {
      toast({ title: '保存失败', variant: 'destructive', description: String(err) });
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleNotesChange = (val: string) => {
    setNotes(val);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(async () => {
      if (prompt?.id) {
        try {
          await updatePromptNotes(prompt.id, val, getSessionUser()?.id);
        } catch {}
      }
    }, 500);
  };

  return {
    name, setName,
    content, setContent,
    tags, setTags,
    notes, setNotes,
    changeLog, setChangeLog,
    isSaving,
    allTags, setAllTags,
    currentVersion,
    updatedDate,
    showOptimize, setShowOptimize,
    showGenerate, setShowGenerate,
    hasVariables,
    handleSave,
    handleNotesChange,
  };
}
