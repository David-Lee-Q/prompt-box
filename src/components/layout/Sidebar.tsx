import { useState, useEffect } from 'react';
import { Star, Plus, Trash2, Edit3, Upload, X, Folder } from 'lucide-react';
import useAppStore from '@/store/useAppStore';
import type { Scene } from '@/types';
import { db } from '@/db';
import { getSessionUser } from '@/store/authStore';
import { PUBLIC_USER_ID } from '@/constants';

interface SidebarProps {
  onNewScene: () => void;
  onEditScene: (scene: Scene) => void;
  onDeleteScene: (scene: Scene) => void;
  onExportScene?: (scene: Scene) => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export default function Sidebar({ onNewScene, onEditScene, onDeleteScene, onExportScene, mobileOpen, onMobileClose }: SidebarProps) {
  const {
    scenes,
    activeSceneId,
    setActiveScene,
    isStarredFilter,
    toggleStarredFilter,
    loadPrompts,
  } = useAppStore();

  const [promptCounts, setPromptCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const user = getSessionUser();
    const query = user ? db.prompts.where('userId').anyOf([user.id, PUBLIC_USER_ID]).toArray() : db.prompts.toArray();
    query.then((all) => {
      const counts: Record<string, number> = {};
      all.forEach((p) => { counts[p.sceneId] = (counts[p.sceneId] || 0) + 1; });
      setPromptCounts(counts);
    });
  }, [scenes]);

  const handleSceneClick = (sceneId: string | null) => {
    if (isStarredFilter) toggleStarredFilter();
    setActiveScene(sceneId);
    loadPrompts();
    onMobileClose?.();
  };

  const handleStarredClick = () => {
    setActiveScene(null);
    toggleStarredFilter();
    loadPrompts();
    onMobileClose?.();
  };

  const sidebarContent = (
    <>
      {/* 场景管理标题 + 新建按钮 */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Folder className="h-4 w-4" />
          场景管理
        </div>
        <button
          onClick={onNewScene}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-primary/10 text-primary dark:text-primary-foreground hover:bg-primary/20 transition-colors text-xs font-semibold"
          aria-label="新建场景"
        >
          <Plus className="h-3.5 w-3.5" />
          新建
        </button>
      </div>

      <div className="flex-1 px-2 py-2 overflow-y-auto">
        <div className="space-y-2">
          <button
            onClick={handleStarredClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg text-sm transition-colors ${
              isStarredFilter
                ? 'bg-primary/10 text-primary dark:text-primary-foreground font-semibold'
                : 'hover:bg-accent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Star className={`h-4 w-4 ${isStarredFilter ? 'fill-current' : ''}`} />
            <span>已收藏</span>
          </button>

          <div className="h-px bg-border my-2 mx-1" />

          {scenes.map((scene) => (
            <div
              key={scene.id}
              className={`group relative overflow-hidden rounded-lg border transition-colors ${
                activeSceneId === scene.id ? 'bg-primary/5 border-primary/20' : 'hover:bg-accent/50 border-border'
              }`}
            >
              <div className="absolute left-1.5 top-4 bottom-4 w-1.5 rounded-full" style={{ backgroundColor: scene.color }} />
              <button
                onClick={() => handleSceneClick(scene.id)}
                className={`w-full text-left pl-6 pr-9 py-3 min-h-[80px] text-sm transition-colors ${
                  activeSceneId === scene.id ? 'text-primary font-semibold' : 'text-foreground'
                }`}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="truncate font-semibold leading-tight">{scene.name}</span>
                  <span className="text-xs text-muted-foreground/70">
                    {promptCounts[scene.id] ?? 0} 条提示词
                  </span>
                </div>
              </button>

              <div className="absolute right-1 top-1/2 -translate-y-1/2 hidden group-hover:flex items-center gap-0.5">
                <button
                  onClick={(e) => { e.stopPropagation(); onEditScene(scene); }}
                  className="size-7 flex items-center justify-center rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="编辑场景"
                >
                  <Edit3 className="size-3.5" />
                </button>
                {onExportScene && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onExportScene(scene); }}
                    className="size-7 flex items-center justify-center rounded-md hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="导出场景"
                  >
                    <Upload className="size-3.5" />
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); onDeleteScene(scene); }}
                  className="size-7 flex items-center justify-center rounded-md hover:bg-background text-muted-foreground hover:text-destructive transition-colors"
                  aria-label="删除场景"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}

          {scenes.length === 0 && (
            <p className="px-3 py-8 text-xs text-muted-foreground text-center">
              暂无场景，点击上方 + 创建
            </p>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col w-80 border-r bg-muted/20">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={onMobileClose} />
          <aside className="relative w-72 h-full bg-background border-r flex flex-col pb-safe">
            <div className="flex items-center justify-between p-3 border-b">
              <span className="text-sm font-medium">菜单</span>
              <button onClick={onMobileClose} className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center" aria-label="关闭菜单">
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </aside>
        </div>
      )}
    </>
  );
}
