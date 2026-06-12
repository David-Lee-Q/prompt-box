import { useState, useMemo, useEffect } from 'react';
import { FileText, Plus, LayoutGrid, List, Star, Tag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import PromptCard from './PromptCard';
import FilterBar from '@/components/search/FilterBar';
import useAppStore from '@/store/useAppStore';
import { getVersionMap } from '@/services/versionService';
import { formatDate } from '@/utils/helpers';

interface PromptListProps {
  onNewPrompt: () => void;
  onPromptClick: (id: string) => void;
  onToggleStar: (id: string, isStarred: boolean) => void;
}

type SortKey = 'name' | 'updatedAt' | 'version';
type SortDir = 'asc' | 'desc';

export default function PromptList({ onNewPrompt, onPromptClick, onToggleStar }: PromptListProps) {
  const { prompts, activeSceneId, scenes, isLoading, isStarredFilter, viewMode, setViewMode } = useAppStore();
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [versionMap, setVersionMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (prompts.length > 0) {
      getVersionMap(prompts.map((p) => p.id)).then(setVersionMap);
    }
  }, [viewMode, prompts]);

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...prompts].sort((a, b) => {
      if (sortKey === 'version') {
        const va = versionMap[a.id] ?? '';
        const vb = versionMap[b.id] ?? '';
        return va.localeCompare(vb, undefined, { numeric: true }) * dir;
      }
      if (sortKey === 'name') {
        return a.name.localeCompare(b.name) * dir;
      }
      return (a.updatedAt - b.updatedAt) * dir;
    });
  }, [prompts, sortKey, sortDir, versionMap]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span className="ml-1 text-xs">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

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
        <div className="flex items-center gap-1 border rounded-md p-0.5">
          <button
            onClick={() => setViewMode('card')}
            className={`p-1.5 rounded-sm transition-colors ${viewMode === 'card' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            title="卡片视图"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-sm transition-colors ${viewMode === 'table' ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            title="表格视图"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 mb-2">
        <FilterBar />
      </div>
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
      ) : viewMode === 'table' ? (
        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('name')}>
                  名称{sortIcon('name')}
                </TableHead>
                <TableHead className="hidden md:table-cell max-w-xs">内容预览</TableHead>
                <TableHead className="hidden md:table-cell">标签</TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('version')}>
                  版本{sortIcon('version')}
                </TableHead>
                <TableHead className="cursor-pointer select-none" onClick={() => handleSort('updatedAt')}>
                  更新时间{sortIcon('updatedAt')}
                </TableHead>
                <TableHead className="w-16 whitespace-nowrap">收藏</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((prompt) => (
                <TableRow
                  key={prompt.id}
                  onClick={() => onPromptClick(prompt.id)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate max-w-[200px]">{prompt.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell max-w-xs">
                    <span className="text-muted-foreground line-clamp-1 text-xs">
                      {prompt.content.slice(0, 80)}{prompt.content.length > 80 ? '...' : ''}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {prompt.tags.slice(0, 3).map((tag) => (
                        <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-primary/5 text-primary/70">
                          <Tag className="h-2.5 w-2.5" />
                          {tag}
                        </span>
                      ))}
                      {prompt.tags.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{prompt.tags.length - 3}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {versionMap[prompt.id] || '-'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(prompt.updatedAt)}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={(e) => { e.stopPropagation(); onToggleStar(prompt.id, !prompt.isStarred); }}
                      className="p-1 rounded hover:bg-accent transition-colors"
                      title={prompt.isStarred ? '取消收藏' : '收藏'}
                    >
                      <Star className={`h-3.5 w-3.5 ${prompt.isStarred ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`} />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {prompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              versionStr={versionMap[prompt.id]}
              onClick={() => onPromptClick(prompt.id)}
              onToggleStar={() => onToggleStar(prompt.id, !prompt.isStarred)}
            />
          ))}
        </div>
      )}
    </>
  );
}
