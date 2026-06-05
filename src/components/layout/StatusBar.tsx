import { useEffect, useState } from 'react';
import { hasTodaysSnapshot, createSnapshot } from '@/utils/snapshot';
import { db } from '@/db';
import useAppStore from '@/store/useAppStore';
import { exportAllData } from '@/utils/export-import';
import { toast } from '@/hooks/use-toast';
import { Database, FileText, AlertTriangle, Download, User } from 'lucide-react';

const LAST_EXPORT_KEY = 'ai-prompt-manager-last-export';

function getDaysSinceLastExport(): number | null {
  try {
    const stored = localStorage.getItem(LAST_EXPORT_KEY);
    if (!stored) return null;
    const last = Number(stored);
    if (Number.isNaN(last)) return null;
    return Math.floor((Date.now() - last) / 86400000);
  } catch {
    return null;
  }
}

function formatStorage(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StatusBar() {
  const { storageInfo, refreshStorageInfo } = useAppStore();
  const [daysSinceExport, setDaysSinceExport] = useState(getDaysSinceLastExport);
  const [promptCount, setPromptCount] = useState(0);

  useEffect(() => {
    refreshStorageInfo();
    db.prompts.count().then(setPromptCount);
  }, [refreshStorageInfo]);

  // Create daily snapshot on first mount
  useEffect(() => {
    if (!hasTodaysSnapshot()) {
      createSnapshot().then(() => db.prompts.count().then(setPromptCount));
    }
  }, []);

  const usagePercent = storageInfo.quota
    ? Math.min(100, Math.round((storageInfo.used / storageInfo.quota) * 100))
    : 0;

  const isNearQuota = usagePercent >= 80;
  const shouldRemindExport = daysSinceExport !== null && daysSinceExport >= 7;

  const handleExport = async () => {
    try {
      await exportAllData();
      localStorage.setItem(LAST_EXPORT_KEY, String(Date.now()));
      setDaysSinceExport(0);
      toast({ title: '导出成功', description: '数据已下载到本地文件', variant: 'success' });
    } catch {
      toast({ title: '导出失败', variant: 'destructive' });
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-4 py-1.5 sm:py-1 border-t text-xs text-muted-foreground bg-muted/20 gap-1 sm:gap-0">
      <div className="flex items-center gap-4 flex-wrap">
        <span className="flex items-center gap-1">
          <Database className="h-3 w-3" />
          {formatStorage(storageInfo.used)}
        </span>
        <span className="flex items-center gap-1">
          <FileText className="h-3 w-3" />
          {promptCount} 条提示词
        </span>
        <span className="text-muted-foreground/30">|</span>
        {isNearQuota && (
          <span className="flex items-center gap-1 text-destructive">
            <AlertTriangle className="h-3 w-3" />
            存储空间即将用尽，建议导出备份
          </span>
        )}
        {!isNearQuota && shouldRemindExport && (
          <button
            onClick={handleExport}
            className="flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline"
          >
            <AlertTriangle className="h-3 w-3" />
            已 {daysSinceExport} 天未导出，建议备份
          </button>
        )}
        {daysSinceExport !== null && daysSinceExport < 7 && !isNearQuota && (
          <span className="text-muted-foreground/70">
            上次导出：{daysSinceExport === 0 ? '刚刚' : `${daysSinceExport} 天前`}
          </span>
        )}
        <button
          onClick={handleExport}
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          title="立即导出备份"
        >
          <Download className="h-3 w-3" />
          导出
        </button>
      </div>

      <span className="flex items-center gap-1.5 text-muted-foreground/60">
        <User className="h-3 w-3" />
        Builder：01461127 / 王伟
      </span>
    </div>
  );
}
