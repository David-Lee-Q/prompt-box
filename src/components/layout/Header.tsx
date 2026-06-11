import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Upload, Download, Plus, Clock, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import useAppStore from '@/store/useAppStore';
import useSettingsStore from '@/store/settingsStore';
import { exportAllData, importData, validateImportData, detectConflicts } from '@/utils/export-import';
import { toast } from '@/hooks/use-toast';
import ThemeToggle from '@/components/layout/ThemeToggle';

interface HeaderProps {
  onNewPrompt?: () => void;
}

export default function Header({ onNewPrompt }: HeaderProps) {
  const navigate = useNavigate();
  const { searchQuery, setSearchQuery, loadAll, loadPrompts, searchHistory, addSearchHistory, clearSearchHistory } = useAppStore();
  const { setShowSettings } = useSettingsStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (query.trim()) addSearchHistory(query.trim());
    setTimeout(() => loadPrompts(), 0);
    setShowHistory(false);
  };

  const handleHistoryClick = (query: string) => {
    handleSearch(query);
  };

  const handleExport = async () => {
    try {
      await exportAllData();
      toast({ title: '导出成功', description: '数据已下载到本地文件' });
    } catch {
      toast({ title: '导出失败', variant: 'destructive', description: '导出过程中出现错误' });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();

      // Validate first
      const validation = validateImportData(text);
      if (validation.error) {
        toast({ title: '导入失败', variant: 'destructive', description: validation.error });
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      // Detect conflicts
      const conflicts = await detectConflicts(validation.data!);

      let strategy: 'overwrite' | 'skip' | 'rename' = 'skip';

      if (conflicts.length > 0) {
        const conflictMsg = conflicts
          .slice(0, 5)
          .map((c) => `${c.type === 'scene' ? '场景' : '提示词'}「${c.name}」`)
          .join('、');
        const suffix = conflicts.length > 5 ? `等 ${conflicts.length} 项` : '';

        const strategyStr = window.prompt(
          `发现 ${conflicts.length} 个冲突（${conflictMsg}${suffix}），请选择处理方式：\n` +
          '输入 1 — 跳过冲突（保留本地数据）\n' +
          '输入 2 — 覆盖冲突（以导入数据为准）\n' +
          '输入 3 — 重命名（为导入数据生成新 ID）',
          '1'
        );
        if (strategyStr === '1') strategy = 'skip';
        else if (strategyStr === '2') strategy = 'overwrite';
        else if (strategyStr === '3') strategy = 'rename';
        else {
          toast({ title: '已取消导入' });
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
      }

      const result = await importData(text, strategy);
      if (result.success) {
        toast({
          title: '导入成功',
          description: `导入了 ${result.stats.scenes} 个场景、${result.stats.prompts} 个提示词${
            result.conflicts.length > 0
              ? `（${result.conflicts.length} 个冲突已${strategy === 'skip' ? '跳过' : strategy === 'rename' ? '重命名' : '覆盖'}）`
              : ''
          }`,
          variant: 'success',
        });
        await loadAll();
        await loadPrompts();
      } else {
        toast({ title: '导入失败', variant: 'destructive', description: result.message });
      }
    } catch {
      toast({ title: '导入失败', variant: 'destructive', description: '文件读取失败，请检查文件格式' });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <header className="flex items-center gap-3 border-b px-3 sm:px-4 py-2">
      <div className="flex-1 min-w-0">
        <h1
          onClick={() => { useAppStore.getState().setActiveScene(null); navigate('/'); }}
          className="flex items-center gap-1.5 text-base sm:text-lg font-bold text-primary whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity"
          title="返回首页"
        >
          <img src="/AI.svg" alt="AI" className="h-5 w-5 sm:h-6 sm:w-6" />
          Prompt Manager
        </h1>
      </div>

      {/* Narrow screen: search icon with dropdown */}
      <div className="relative md:hidden" ref={searchRef}>
        <button
          onClick={() => { setSearchExpanded(!searchExpanded); setTimeout(() => searchInputRef.current?.focus(), 50); }}
          className="p-1.5 rounded hover:bg-accent transition-colors"
          title="搜索"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
        </button>

        {searchExpanded && (
          <div className="absolute top-full left-1/2 -translate-x-1/2 z-30 mt-1 w-72 bg-popover border rounded-md shadow-lg p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                id="search-input"
                placeholder="搜索提示词..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowHistory(false);
                  setTimeout(() => loadPrompts(), 0);
                }}
                onFocus={() => setShowHistory(searchHistory.length > 0 && !searchQuery)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setSearchExpanded(false);
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleSearch(searchQuery);
                    setSearchExpanded(false);
                  }
                }}
                className="pl-8"
              />
            </div>
            {showHistory && searchHistory.length > 0 && (
              <div className="mt-1">
                <div className="flex items-center justify-between px-1 py-0.5">
                  <span className="text-xs text-muted-foreground">搜索历史</span>
                  <button onClick={clearSearchHistory} className="text-xs text-muted-foreground hover:text-foreground">
                    清除
                  </button>
                </div>
                {searchHistory.map((q) => (
                  <button
                    key={q}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { handleHistoryClick(q); setSearchExpanded(false); }}
                    className="w-full flex items-center gap-2 px-1 py-1.5 text-sm hover:bg-accent rounded transition-colors"
                  >
                    <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{q}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Wide screen: inline search bar */}
      <div className="hidden md:block relative w-56 xl:w-64 mx-auto" ref={searchRef}>
        <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="search-input-wide"
          placeholder="搜索提示词..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setShowHistory(false);
            setTimeout(() => loadPrompts(), 0);
          }}
          onFocus={() => setShowHistory(searchHistory.length > 0 && !searchQuery)}
          onBlur={() => setTimeout(() => setShowHistory(false), 200)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchQuery.trim()) {
              handleSearch(searchQuery);
            }
          }}
          className="pl-8"
        />
        {showHistory && searchHistory.length > 0 && (
          <div className="absolute top-full left-0 right-0 z-20 mt-1 bg-popover border rounded-md shadow-md">
            <div className="flex items-center justify-between px-3 py-1.5 border-b">
              <span className="text-xs text-muted-foreground">搜索历史</span>
              <button onClick={clearSearchHistory} className="text-xs text-muted-foreground hover:text-foreground">
                清除
              </button>
            </div>
            {searchHistory.map((q) => (
              <button
                key={q}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleHistoryClick(q)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{q}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-0.5 sm:gap-1.5">
        {onNewPrompt && (
          <Button variant="default" size="sm" onClick={onNewPrompt} className="active:scale-[0.98] transition-all hidden sm:inline-flex">
            <Plus className="h-4 w-4 mr-1" />
            新建提示词
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleExport} title="导出数据" className="active:scale-[0.98] transition-all">
          <Upload className="h-4 w-4 xl:mr-1" />
          <span className="hidden xl:inline">导出</span>
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} title="导入数据" className="active:scale-[0.98] transition-all">
          <Download className="h-4 w-4 xl:mr-1" />
          <span className="hidden xl:inline">导入</span>
        </Button>
        <ThemeToggle />
        <Button variant="ghost" size="icon" onClick={() => setShowSettings(true)} title="AI 设置">
          <Settings className="h-4 w-4" />
        </Button>
        <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
      </div>
    </header>
  );
}
