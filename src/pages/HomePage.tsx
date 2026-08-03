import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu } from 'lucide-react';
import Header from '@/components/layout/Header';
import Sidebar from '@/components/layout/Sidebar';
import MainContent from '@/components/layout/MainContent';
import StatusBar from '@/components/layout/StatusBar';
import SceneForm from '@/components/scene/SceneForm';
import PromptList from '@/components/prompt/PromptList';
import useAppStore from '@/store/useAppStore';
import useAuthStore from '@/store/authStore';
import { createScene, updateScene, deleteScene } from '@/services/sceneService';
import { toggleStarPrompt } from '@/services/promptService';
import { exportAllData, exportScene } from '@/utils/export-import';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import type { Scene } from '@/types';
import { toast } from '@/hooks/use-toast';

export default function HomePage() {
  const navigate = useNavigate();
  const {
    loadAll,
    loadPrompts,
    activeSceneId,
    loadError,
  } = useAppStore();

  const currentUser = useAuthStore((s) => s.currentUser);

  const [sceneFormOpen, setSceneFormOpen] = useState(false);
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [deletingScene, setDeletingScene] = useState<Scene | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    loadPrompts();
  }, [activeSceneId, loadPrompts]);

  // ----- Scene operations -----
  const handleNewScene = useCallback(() => {
    setEditingScene(null);
    setSceneFormOpen(true);
  }, []);

  const handleEditScene = useCallback((scene: Scene) => {
    setEditingScene(scene);
    setSceneFormOpen(true);
  }, []);

  const confirmDeleteScene = async () => {
    if (!deletingScene) return;
    const scenePrompts = useAppStore.getState().prompts.filter(p => p.sceneId === deletingScene.id);
    const hasPrompts = scenePrompts.length > 0;
    if (hasPrompts && !window.confirm(`场景「${deletingScene.name}」下有关联的提示词，删除场景将同时删除其下的所有提示词，确定继续？`)) {
      setDeletingScene(null);
      return;
    }
    try {
      await deleteScene(deletingScene.id);
      toast({ title: '删除成功', description: `场景「${deletingScene.name}」已删除` });
      // Reset activeSceneId if the deleted scene was active
      if (useAppStore.getState().activeSceneId === deletingScene.id) {
        useAppStore.getState().setActiveScene(null);
      }
      await loadAll();
      await loadPrompts();
    } catch (err) {
      toast({ title: '删除失败', variant: 'destructive', description: String(err) });
    }
    setDeletingScene(null);
  };

  const handleSceneSubmit = async (data: Omit<Scene, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => {
    try {
      if (editingScene) {
        await updateScene(editingScene.id, data);
        toast({ title: '更新成功', description: `场景「${data.name}」已更新` });
      } else {
        await createScene({ ...data, userId: currentUser!.id }, currentUser!.id);
        toast({ title: '创建成功', description: `场景「${data.name}」已创建` });
      }
      await loadAll();
    } catch (err) {
      toast({ title: editingScene ? '更新失败' : '创建失败', variant: 'destructive', description: String(err) });
    }
  };

  // ----- Prompt operations -----
  const handleNewPrompt = () => {
    if (!activeSceneId) {
      toast({ title: '请先选择场景', variant: 'destructive' });
      return;
    }
    navigate(`/prompts/new?sceneId=${activeSceneId}`);
  };

  const handlePromptClick = (id: string) => {
    navigate(`/prompts/${id}`);
  };

  const handleExportScene = useCallback(async (scene: Scene) => {
    try {
      await exportScene(scene.id);
      toast({ title: '导出成功', description: `场景「${scene.name}」已导出` });
    } catch (err) {
      toast({ title: '导出失败', variant: 'destructive', description: String(err) });
    }
  }, []);

  const handleExport = useCallback(async () => {
    try {
      await exportAllData();
      toast({ title: '导出成功' });
    } catch {
      toast({ title: '导出失败', variant: 'destructive' });
    }
  }, []);

  useKeyboardShortcuts({
    'Ctrl+F': () => document.getElementById('search-input')?.focus(),
    'Ctrl+Shift+F': () => document.getElementById('search-input')?.focus(),
    'Ctrl+E': handleExport,
  });

  const handleToggleStar = async (id: string, isStarred: boolean) => {
    try {
      await toggleStarPrompt(id, isStarred);
      await loadPrompts();
    } catch {
      toast({ title: '操作失败', variant: 'destructive' });
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <Header onNewPrompt={handleNewPrompt} />
      {loadError && (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2 text-sm text-destructive flex items-center gap-2">
          <span>{loadError}</span>
          <button onClick={() => loadAll()} className="underline hover:text-destructive/80">重试</button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <button
          onClick={() => setMobileSidebarOpen(true)}
          className="md:hidden fixed bottom-4 left-4 z-40 p-3 min-h-[44px] min-w-[44px] bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors active:scale-[0.95]"
          title="打开菜单"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Sidebar
          onNewScene={handleNewScene}
          onEditScene={handleEditScene}
          onDeleteScene={setDeletingScene}
          onExportScene={handleExportScene}
          mobileOpen={mobileSidebarOpen}
          onMobileClose={() => setMobileSidebarOpen(false)}
        />

        <MainContent>
          <PromptList
            onNewPrompt={handleNewPrompt}
            onPromptClick={handlePromptClick}
            onToggleStar={handleToggleStar}
          />
        </MainContent>
      </div>

      {/* Scene Form Dialog */}
      <SceneForm
        open={sceneFormOpen}
        onOpenChange={setSceneFormOpen}
        onSubmit={handleSceneSubmit}
        initialData={editingScene}
      />

      <StatusBar />

      {/* Delete Scene Confirmation */}
      {deletingScene && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center" onClick={() => setDeletingScene(null)}>
          <div className="bg-background rounded-lg p-6 max-w-sm w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium mb-2">删除场景</h3>
            <p className="text-sm text-muted-foreground mb-4">
              确定要删除场景「{deletingScene.name}」吗？此操作不可撤销。
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingScene(null)}
                className="px-4 py-2 text-sm rounded-md border hover:bg-accent"
              >
                取消
              </button>
              <button
                onClick={confirmDeleteScene}
                className="px-4 py-2 text-sm rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
