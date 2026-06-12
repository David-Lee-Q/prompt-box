import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useSettingsStore from '@/store/settingsStore';
import { generateId } from '@/utils/helpers';
import { toast } from '@/hooks/use-toast';
import { getOrCreateProvider, evictProvider } from '@/services/ai';
import type { ProviderConfig, APIFormat } from '@/types/ai';
import { Plus, Trash2, Check, Settings } from 'lucide-react';

const EMPTY_FORM: Omit<ProviderConfig, 'id'> = {
  name: '',
  format: 'openai',
  apiKey: '',
  baseUrl: '',
  model: '',
};

export default function AISettings() {
  const {
    settings,
    showSettings,
    setShowSettings,
    addProvider,
    updateProvider,
    removeProvider,
    setActiveProvider,
  } = useSettingsStore();

  const providers = settings?.providers ?? [];
  const activeId = settings?.activeProviderId ?? null;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!showSettings) {
      setEditingId(null);
      setAdding(false);
    }
  }, [showSettings]);

  const startEdit = (p: ProviderConfig) => {
    setAdding(false);
    setEditingId(p.id);
    setForm({ name: p.name, format: p.format, apiKey: p.apiKey, baseUrl: p.baseUrl, model: p.model });
  };

  const startAdd = () => {
    setEditingId(null);
    setAdding(true);
    setForm(EMPTY_FORM);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setAdding(false);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast({ title: '请输入提供商名称', variant: 'destructive' });
      return;
    }
    if (editingId) {
      updateProvider(editingId, form);
      toast({ title: '已更新', variant: 'success' });
      setEditingId(null);
    } else {
      addProvider({ id: generateId(), ...form });
      toast({ title: '已添加', variant: 'success' });
      setAdding(false);
    }
  };

  const handleDelete = (id: string) => {
    removeProvider(id);
    if (editingId === id) cancelEdit();
    toast({ title: '已删除' });
  };

  const handleTest = async () => {
    if (!form.apiKey.trim()) {
      toast({ title: '请先输入 API Key', variant: 'destructive' });
      return;
    }
    if (!form.model.trim()) {
      toast({ title: '请先输入模型 ID', variant: 'destructive' });
      return;
    }
    setTesting(true);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);

      // Use unique ID per test to avoid Pool cache returning stale credentials
      const testId = `test-${form.format}-${Date.now()}`;
      const provider = getOrCreateProvider({
        id: testId,
        name: 'Test',
        format: form.format,
        apiKey: form.apiKey.trim(),
        model: form.model.trim(),
        baseUrl: form.baseUrl.trim() || '',
      });

      const result = await provider.testConnection(controller.signal);
      evictProvider(testId); // clean up after test
      clearTimeout(timer);

      if (result.ok) {
        toast({ title: '连接成功', description: `延迟 ${result.latency}ms` });
      } else {
        throw new Error(result.error || '连接失败，请检查 API Key 和网络连接');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '连接失败';
      toast({ title: '连接失败', description: msg, variant: 'destructive' });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AI 设置</DialogTitle>
          <DialogDescription>管理多个 AI 提供商，一键切换用于对比</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Provider list */}
          {providers.length > 0 && (
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto overflow-x-hidden p-0.5 -m-0.5">
              {providers.map((p) => (
                <div key={p.id}>
                  <div
                    onClick={() => setSelectedId(p.id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors cursor-pointer ${
                      activeId === p.id
                        ? 'border-primary bg-primary/5'
                        : selectedId === p.id
                          ? 'border-muted-foreground/30 bg-accent/30'
                          : 'border-border hover:bg-accent/50'
                    } ${editingId === p.id ? 'ring-1 ring-primary' : ''}`}
                  >
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{p.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {p.format === 'openai' ? 'OpenAI' : 'Anthropic'}
                        </span>
                        {activeId === p.id && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                            默认
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        <div className="truncate">{p.model || '未设置模型'}</div>
                        {p.baseUrl && <div className="text-[10px] break-all">{p.baseUrl}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      {activeId !== p.id && p.apiKey && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); setActiveProvider(p.id); }}
                          title="设为默认"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); startEdit(p); }} title="编辑">
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} title="删除">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                  {/* Inline edit form */}
                  {editingId === p.id && (
                    <div className="mt-1.5 space-y-3 rounded-lg border p-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="ai-provider">AI 提供商</Label>
                        <Input
                          id="ai-provider"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          placeholder="如：OpenAI、DeepSeek、Anthropic..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ai-format">API 格式</Label>
                        <select
                          id="ai-format"
                          value={form.format}
                          onChange={(e) => setForm({ ...form, format: e.target.value as APIFormat })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="openai">OpenAI 兼容格式</option>
                          <option value="anthropic">Anthropic 兼容格式</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ai-baseurl">请求地址 / Base URL</Label>
                        <Input
                          id="ai-baseurl"
                          value={form.baseUrl}
                          onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                          placeholder="留空使用默认端点"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ai-apikey">API Key</Label>
                        <Input
                          id="ai-apikey"
                          type="password"
                          value={form.apiKey}
                          onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                          placeholder="sk-..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ai-model">模型 ID</Label>
                        <Input
                          id="ai-model"
                          value={form.model}
                          onChange={(e) => setForm({ ...form, model: e.target.value })}
                          placeholder="如：gpt-4o、deepseek-chat..."
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <Button onClick={handleTest} variant="outline" disabled={testing} size="sm">
                          {testing ? '测试中...' : '测试连接'}
                        </Button>
                        <div className="flex-1" />
                        <Button onClick={cancelEdit} variant="ghost" size="sm">取消</Button>
                        <Button onClick={handleSave} size="sm">保存</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {providers.length === 0 && !adding && (
            <div className="text-center py-6 text-sm text-muted-foreground">
              暂无配置的 AI 提供商，点击下方按钮添加
            </div>
          )}

          {/* Add button */}
          {!adding && (
            <Button variant="outline" size="sm" onClick={startAdd} className="w-full">
              <Plus className="h-3.5 w-3.5 mr-1" />
              添加提供商
            </Button>
          )}

          {/* Add form */}
          {adding && (
            <div className="space-y-3 rounded-lg border p-3">
              <div className="space-y-1.5">
                <Label htmlFor="ai-provider">AI 提供商</Label>
                <Input
                  id="ai-provider"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：OpenAI、DeepSeek、Anthropic..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ai-format">API 格式</Label>
                <select
                  id="ai-format"
                  value={form.format}
                  onChange={(e) => setForm({ ...form, format: e.target.value as APIFormat })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="openai">OpenAI 兼容格式</option>
                  <option value="anthropic">Anthropic 兼容格式</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ai-baseurl">请求地址 / Base URL</Label>
                <Input
                  id="ai-baseurl"
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  placeholder="留空使用默认端点"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ai-apikey">API Key</Label>
                <Input
                  id="ai-apikey"
                  type="password"
                  value={form.apiKey}
                  onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                  placeholder="sk-..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="ai-model">模型 ID</Label>
                <Input
                  id="ai-model"
                  value={form.model}
                  onChange={(e) => setForm({ ...form, model: e.target.value })}
                  placeholder="如：gpt-4o、deepseek-chat..."
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button onClick={handleTest} variant="outline" disabled={testing} size="sm">
                  {testing ? '测试中...' : '测试连接'}
                </Button>
                <div className="flex-1" />
                <Button onClick={cancelEdit} variant="ghost" size="sm">取消</Button>
                <Button onClick={handleSave} size="sm">
                  {editingId ? '保存' : '添加'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
