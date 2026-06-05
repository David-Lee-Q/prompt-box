import { FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import PromptCard from './PromptCard';
import FilterBar from '@/components/search/FilterBar';
import useAppStore from '@/store/useAppStore';

interface PromptListProps {
  onNewPrompt: () => void;
  onPromptClick: (id: string) => void;
  onToggleStar: (id: string, isStarred: boolean) => void;
}

export default function PromptList({ onNewPrompt, onPromptClick, onToggleStar }: PromptListProps) {
  const { prompts, activeSceneId, scenes, isLoading, isStarredFilter } = useAppStore();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (!activeSceneId && prompts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-60 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">选择一个场景</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          从左侧选择一个场景，或查看所有已收藏的提示词
        </p>
      </div>
    );
  }

  const currentScene = scenes.find((s) => s.id === activeSceneId);
  const title = isStarredFilter ? '已收藏' : currentScene?.name ?? '全部提示词';

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {currentScene && (
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: currentScene.color }}
            />
          )}
          <h2 className="text-base font-semibold">{title}</h2>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {prompts.length} 条
          </span>
        </div>
      </div>
      <FilterBar />
      {prompts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-60 text-center">
          <FileText className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {currentScene ? `「${currentScene.name}」中暂无提示词` : '暂无提示词'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-sm">
            {currentScene
              ? `在「${currentScene.name}」场景下创建第一个提示词`
              : '请先选择一个场景或创建新场景'}
          </p>
          {currentScene && (
            <Button onClick={onNewPrompt} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              创建提示词
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {prompts.map((prompt) => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            onClick={() => onPromptClick(prompt.id)}
            onToggleStar={() => onToggleStar(prompt.id, !prompt.isStarred)}
          />
        ))}
        </div>
      )}
    </>
  );
}
