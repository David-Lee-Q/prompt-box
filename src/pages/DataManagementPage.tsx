import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Database, Download, Upload, CloudUpload, CloudDownload,
  LogOut, FileText, Layers, HardDrive, type LucideIcon,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { db } from '@/db';
import { getSessionUser } from '@/store/authStore';
import { PUBLIC_USER_ID } from '@/constants';
import useAppStore from '@/store/useAppStore';
import { exportAllData, importData, validateImportData, detectConflicts, type ImportResult } from '@/utils/export-import';
import {
  SyncApiError, cloudLogin, cloudPull, cloudPush, cloudRegister, cloudStatus,
  clearCloudSession, getCloudUsername, getLastSyncedAt, setCloudSession, setLastSyncedAt,
  type CloudStatus,
} from '@/services/syncService';
import type { ExportData } from '@/types';

function formatTime(ts: number | null): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

function formatStorage(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function StatTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-semibold leading-tight">{value}</p>
      </div>
    </div>
  );
}

export default function DataManagementPage() {
  const navigate = useNavigate();
  const { storageInfo, refreshStorageInfo, loadAll, loadPrompts } = useAppStore();

  const [promptCount, setPromptCount] = useState(0);
  const [versionCount, setVersionCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importConflict, setImportConflict] = useState<{ conflicts: ImportResult['conflicts']; text: string } | null>(null);

  const [cloudUser, setCloudUser] = useState<string | null>(getCloudUsername());
  const [cloudUsername, setCloudUsername] = useState('');
  const [cloudPassword, setCloudPassword] = useState('');
  const [cloudBusy, setCloudBusy] = useState(false);
  const [status, setStatus] = useState<CloudStatus | null>(null);
  const [lastSyncedAt, setLastSynced] = useState<number | null>(getLastSyncedAt());
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const refreshCounts = useCallback(async () => {
    const u = getSessionUser();
    const [pc, vc] = await Promise.all([
      u ? db.prompts.where('userId').anyOf([u.id, PUBLIC_USER_ID]).count() : db.prompts.count(),
      db.versions.count(),
    ]);
    setPromptCount(pc);
    setVersionCount(vc);
  }, []);

  useEffect(() => {
    refreshCounts();
    refreshStorageInfo();
  }, [refreshCounts, refreshStorageInfo]);

  const refreshCloudStatus = useCallback(async () => {
    try {
      setStatus(await cloudStatus());
    } catch (e) {
      if (e instanceof SyncApiError && e.status === 401) {
        clearCloudSession();
        setCloudUser(null);
      }
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    if (!cloudUser) return;
    refreshCloudStatus();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshCloudStatus();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [cloudUser, refreshCloudStatus]);

  const collectPayload = async (): Promise<ExportData> => {
    const u = getSessionUser();
    const [scenes, prompts, versions] = await Promise.all([
      u ? db.scenes.where('userId').anyOf([u.id, PUBLIC_USER_ID]).toArray() : db.scenes.toArray(),
      u ? db.prompts.where('userId').anyOf([u.id, PUBLIC_USER_ID]).toArray() : db.prompts.toArray(),
      db.versions.toArray(),
    ]);
    return { version: '1.0', exportedAt: new Date().toISOString(), scenes, prompts, versions };
  };

  const handleBackup = async () => {
    try {
      await exportAllData(getSessionUser()?.id);
      toast({ title: '备份成功', description: '数据已下载到本地文件', variant: 'success' });
    } catch {
      toast({ title: '备份失败', variant: 'destructive', description: '备份过程中出现错误' });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const validation = validateImportData(text);
      if (validation.error) {
        toast({ title: '导入失败', variant: 'destructive', description: validation.error });
      } else {
        const conflicts = await detectConflicts(validation.data!);
        if (conflicts.length > 0) {
          setImportConflict({ conflicts, text });
        } else {
          await applyImport(text, 'skip');
        }
      }
    } catch {
      toast({ title: '导入失败', variant: 'destructive', description: '文件读取失败，请检查文件格式' });
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const applyImport = async (text: string, strategy: 'overwrite' | 'skip' | 'rename') => {
    const u = getSessionUser();
    const result = await importData(text, strategy, u?.id);
    if (result.success) {
      toast({
        title: '导入成功',
        description: `导入了 ${result.stats.scenes} 个场景、${result.stats.prompts} 个提示词`,
        variant: 'success',
      });
      await loadAll();
      await loadPrompts();
      await refreshCounts();
    } else {
      toast({ title: '导入失败', variant: 'destructive', description: result.message });
    }
  };

  const handleImportResolve = async (strategy: 'overwrite' | 'skip' | 'rename') => {
    if (!importConflict) return;
    const { text } = importConflict;
    setImportConflict(null);
    await applyImport(text, strategy);
  };

  const handleCloudAuth = async (mode: 'login' | 'register') => {
    const name = cloudUsername.trim();
    if (name.length < 2 || !cloudPassword) {
      toast({ title: '请输入用户名和密码', variant: 'destructive' });
      return;
    }
    setCloudBusy(true);
    try {
      const r = mode === 'login'
        ? await cloudLogin(name, cloudPassword)
        : await cloudRegister(name, cloudPassword);
      setCloudSession(r.token, r.username);
      setCloudUser(r.username);
      setCloudPassword('');
      toast({ title: mode === 'login' ? '登录成功' : '注册成功', variant: 'success' });
    } catch (e) {
      toast({
        title: '操作失败',
        description: e instanceof Error ? e.message : '请重试',
        variant: 'destructive',
      });
    } finally {
      setCloudBusy(false);
    }
  };

  const handleCloudLogout = () => {
    clearCloudSession();
    setCloudUser(null);
    setStatus(null);
    setLastSynced(null);
  };

  const doPush = async (force: boolean) => {
    const u = getSessionUser();
    if (!u) {
      toast({ title: '请先登录', variant: 'destructive' });
      return;
    }
    setCloudBusy(true);
    try {
      const payload = await collectPayload();
      const r = await cloudPush(payload, getLastSyncedAt(), force);
      setLastSyncedAt(r.updatedAt);
      setLastSynced(r.updatedAt);
      setConfirmOverwrite(false);
      toast({
        title: '同步成功',
        description: `已将 ${payload.prompts.length} 条提示词上传到云端`,
        variant: 'success',
      });
      await refreshCloudStatus();
    } catch (e) {
      if (e instanceof SyncApiError) {
        if (e.status === 401) {
          clearCloudSession();
          setCloudUser(null);
          toast({ title: '云端登录已过期', description: '请重新登录', variant: 'destructive' });
        } else if (e.status === 409) {
          setConfirmOverwrite(true);
        } else {
          toast({ title: '同步失败', description: e.message, variant: 'destructive' });
        }
      } else {
        toast({ title: '同步失败', description: '同步过程中出现错误', variant: 'destructive' });
      }
    } finally {
      setCloudBusy(false);
    }
  };

  const handlePull = async () => {
    const u = getSessionUser();
    if (!u) {
      toast({ title: '请先登录', variant: 'destructive' });
      return;
    }
    setCloudBusy(true);
    try {
      const { payload, updatedAt } = await cloudPull();
      const result = await importData(JSON.stringify(payload), 'overwrite', u.id);
      setLastSyncedAt(updatedAt);
      setLastSynced(updatedAt);
      await loadAll();
      await loadPrompts();
      await refreshCounts();
      toast({ title: '恢复成功', description: result.message, variant: 'success' });
      await refreshCloudStatus();
    } catch (e) {
      if (e instanceof SyncApiError) {
        if (e.status === 401) {
          clearCloudSession();
          setCloudUser(null);
          toast({ title: '云端登录已过期', description: '请重新登录', variant: 'destructive' });
        } else if (e.status === 404) {
          toast({ title: '云端暂无数据', description: '请先在一台设备上同步到云端', variant: 'destructive' });
        } else {
          toast({ title: '恢复失败', description: e.message, variant: 'destructive' });
        }
      } else {
        toast({ title: '恢复失败', description: '恢复过程中出现错误', variant: 'destructive' });
      }
    } finally {
      setCloudBusy(false);
    }
  };

  return (
    <div className="min-h-dvh bg-muted/20">
      <header className="border-b bg-background px-4 py-3 pt-safe">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          返回
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 pb-safe space-y-4">
        <h1 className="text-xl font-bold">数据管理</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              数据概览
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <StatTile icon={FileText} label="提示词总数" value={String(promptCount)} />
              <StatTile icon={Layers} label="版本总数" value={String(versionCount)} />
              <StatTile icon={HardDrive} label="当前存储用量" value={formatStorage(storageInfo.used)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              数据备份
            </CardTitle>
            <CardDescription>导出所有数据为 JSON 文件，便于迁移或备份</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleBackup}>
                <Download className="h-3.5 w-3.5 mr-1" />
                备份数据
              </Button>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-3.5 w-3.5 mr-1" />
                导入数据
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">备份成功后自动生成文件下载，请检查浏览器下载记录</p>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImportFile} className="hidden" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudUpload className="h-4 w-4" />
              数据同步
            </CardTitle>
            <CardDescription>将当前数据同步到其他设备（需要登录）</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!cloudUser ? (
              <div className="max-w-sm space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="cloud-username">云端账号</Label>
                  <Input
                    id="cloud-username"
                    placeholder="用户名（2-32 个字符）"
                    value={cloudUsername}
                    onChange={(e) => setCloudUsername(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cloud-password">密码</Label>
                  <Input
                    id="cloud-password"
                    type="password"
                    placeholder="至少 6 个字符"
                    value={cloudPassword}
                    onChange={(e) => setCloudPassword(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCloudAuth('login'); }}
                  />
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleCloudAuth('login')} disabled={cloudBusy}>
                    登录
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleCloudAuth('register')} disabled={cloudBusy}>
                    注册
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-sm">
                    已登录：<span className="font-semibold">{cloudUser}</span>
                  </span>
                  <Button variant="ghost" size="sm" onClick={handleCloudLogout}>
                    <LogOut className="h-3.5 w-3.5 mr-1" />
                    退出云端
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => doPush(false)} disabled={cloudBusy}>
                    <CloudUpload className="h-3.5 w-3.5 mr-1" />
                    {cloudBusy ? '处理中...' : '同步到云端'}
                  </Button>
                  <Button size="sm" variant="outline" onClick={handlePull} disabled={cloudBusy}>
                    <CloudDownload className="h-3.5 w-3.5 mr-1" />
                    从云端恢复
                  </Button>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p>本地上次同步时间：{formatTime(lastSyncedAt)}</p>
                  <p>
                    云端更新时间：{status?.hasData ? formatTime(status.updatedAt) : '暂无数据'}
                    {status?.hasData ? `（${status.promptCount} 条提示词）` : ''}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {importConflict && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setImportConflict(null)}>
          <div className="bg-background border rounded-lg shadow-lg p-4 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-2">发现 {importConflict.conflicts.length} 个冲突</h3>
            <ul className="text-xs text-muted-foreground mb-3 max-h-24 overflow-y-auto space-y-1">
              {importConflict.conflicts.slice(0, 10).map((c, i) => (
                <li key={i}>{c.type === 'scene' ? '场景' : '提示词'}「{c.name}」</li>
              ))}
              {importConflict.conflicts.length > 10 && (
                <li className="text-muted-foreground/60">...等 {importConflict.conflicts.length} 项</li>
              )}
            </ul>
            <p className="text-xs text-muted-foreground mb-3">请选择处理方式：</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => handleImportResolve('skip')} className="w-full text-left px-3 py-2 rounded-md text-sm border hover:bg-accent transition-colors">
                跳过冲突（保留本地数据）
              </button>
              <button onClick={() => handleImportResolve('overwrite')} className="w-full text-left px-3 py-2 rounded-md text-sm border hover:bg-accent transition-colors">
                覆盖冲突（以导入数据为准）
              </button>
              <button onClick={() => handleImportResolve('rename')} className="w-full text-left px-3 py-2 rounded-md text-sm border hover:bg-accent transition-colors">
                重命名（为导入数据生成新 ID）
              </button>
              <button onClick={() => setImportConflict(null)} className="w-full text-center px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">
                取消
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOverwrite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setConfirmOverwrite(false)}>
          <div className="bg-background border rounded-lg shadow-lg p-4 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-2">云端数据冲突</h3>
            <p className="text-sm text-muted-foreground mb-4">
              云端数据在本地上次同步之后有更新，继续同步将用本地数据覆盖云端数据。也可以改为从云端恢复本地数据。
            </p>
            <div className="flex flex-col gap-2">
              <button onClick={() => doPush(true)} className="w-full px-3 py-2 rounded-md text-sm border border-destructive text-destructive hover:bg-destructive/10 transition-colors">
                继续同步（覆盖云端）
              </button>
              <button onClick={handlePull} className="w-full px-3 py-2 rounded-md text-sm border hover:bg-accent transition-colors">
                从云端恢复（覆盖本地）
              </button>
              <button onClick={() => setConfirmOverwrite(false)} className="w-full text-center px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground transition-colors">
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
