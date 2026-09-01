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
import { Plus, Trash2, Check, Settings, Eye, EyeOff } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import changelogRaw from '../../../CHANGELOG.md?raw';

const EMPTY_FORM: Omit<ProviderConfig, 'id'> = {
  name: '',
  format: 'openai',
  apiKey: '',
  baseUrl: '',
  model: '',
};

const CHANGELOG_COMPONENTS: Components = {
  h2: ({ children }) => <div className="font-semibold text-foreground">{children}</div>,
  h3: ({ children }) => <div className="font-medium text-foreground mt-2">{children}</div>,
  ul: ({ children }) => <ul className="list-disc pl-4 space-y-1">{children}</ul>,
  hr: () => null,
};

// CHANGELOG 按时间倒序排列，取最新的 count 个版本条目
function getRecentChangelogMd(raw: string, count = 2): string {
  const lines = raw.split('\n');
  const start = lines.findIndex((l) => /^## v\d/.test(l));
  if (start === -1) return '';
  let seen = 0;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && /^## v\d/.test(line)) {
      seen += 1;
      if (seen > count) {
        end = i;
        break;
      }
    }
  }
  return lines.slice(start, end).join('\n').trim();
}

const RECENT_CHANGELOG_MD = getRecentChangelogMd(changelogRaw);

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
  const [showKey, setShowKey] = useState(false);

  const editingProvider = providers.find((p) => p.id === editingId) ?? null;
  const isEditingBuiltIn = !!editingProvider?.builtIn;

  useEffect(() => {
    if (!showSettings) {
      setEditingId(null);
      setAdding(false);
    }
  }, [showSettings]);

  const startEdit = (p: ProviderConfig) => {
    if (p.builtIn) return;
    setAdding(false);
    setEditingId(p.id);
    setForm({
      name: p.name,
      format: p.format,
      apiKey: p.builtIn ? '' : p.apiKey,
      baseUrl: p.baseUrl,
      model: p.model,
    });
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
    const trimmed = { ...form, apiKey: form.apiKey.trim(), baseUrl: form.baseUrl.trim() };
    if (editingId) {
      const original = providers.find((p) => p.id === editingId);
      // Built-in model: empty apiKey means keep existing (encrypted) key unchanged
      if (original?.builtIn && !trimmed.apiKey) {
        delete (trimmed as Partial<ProviderConfig>).apiKey;
      }
      updateProvider(editingId, trimmed);
      toast({ title: '已更新', variant: 'success' });
      setEditingId(null);
    } else {
      addProvider({ id: generateId(), ...trimmed });
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
    // Built-in model test uses the in-memory (decrypted) key when the form field is untouched
    const testApiKey = isEditingBuiltIn && !form.apiKey.trim()
      ? (editingProvider?.apiKey ?? '')
      : form.apiKey.trim();
    if (!testApiKey) {
      toast({ title: '请先输入 API Key', variant: 'destructive' });
      return;
    }
    if (!form.model.trim()) {
      toast({ title: '请先输入模型 ID', variant: 'destructive' });
      return;
    }
    setTesting(true);
    let testId = '';
    let timer: ReturnType<typeof setTimeout> | null = null;

    // Request host permission BEFORE test (must be in user gesture context)
    console.log('[perm-check] chrome:', !!chrome, 'permissions:', !!chrome?.permissions, 'baseUrl:', form.baseUrl.trim());
    if (chrome?.permissions && form.baseUrl.trim()) {
      try {
        const origin = new URL(form.baseUrl.trim()).origin + '/*';
        console.log('[perm-check] origin:', origin);
        const hasPermission = await new Promise<boolean>(r =>
          chrome.permissions.contains({ origins: [origin] }, (result) => r(result))
        );
        console.log('[perm-check] hasPermission:', hasPermission);
        if (!hasPermission) {
          const granted = await new Promise<boolean>(r =>
            chrome.permissions.request({ origins: [origin] }, (result) => r(result))
          );
          if (!granted) {
            setTesting(false);
            toast({ title: '连接失败', description: '需要授予域名访问权限', variant: 'destructive' });
            return;
          }
        }
      } catch { /* URL parse error — skip, let testConnection handle it */ }
    }

    try {
      const controller = new AbortController();
      timer = setTimeout(() => controller.abort(), 15000);

      testId = `test-${form.format}-${Date.now()}`;
      const provider = getOrCreateProvider({
        id: testId,
        name: 'Test',
        format: form.format,
        apiKey: testApiKey,
        model: form.model.trim(),
        baseUrl: form.baseUrl.trim() || '',
      });

      const result = await provider.testConnection(controller.signal);

      if (result.ok) {
        toast({ title: '连接成功', description: `延迟 ${result.latency}ms` });
      } else {
        throw new Error(result.error || '连接失败，请检查 API Key 和网络连接');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '连接失败';
      toast({ title: '连接失败', description: msg, variant: 'destructive' });
    } finally {
      if (timer) clearTimeout(timer);
      if (testId) evictProvider(testId);
      setTesting(false);
    }
  };

  return (
    <Dialog open={showSettings} onOpenChange={setShowSettings}>
      <DialogContent className="max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle>AI 设置</DialogTitle>
          <DialogDescription>管理多个 AI 提供商，一键切换用于对比</DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 px-0.5">
          {/* Provider list */}
          {providers.length > 0 && (
            <div className="space-y-1.5">
              {providers.map((p) => (
                <div key={p.id}>
                  <div
                    onClick={() => !p.builtIn && setSelectedId(p.id)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 transition-colors ${
                      activeId === p.id
                        ? 'border-primary bg-primary/5'
                        : selectedId === p.id
                          ? 'border-muted-foreground/30 bg-accent/30'
                          : 'border-border'
                    } ${editingId === p.id ? 'ring-1 ring-primary' : ''} ${p.builtIn ? 'cursor-default' : 'cursor-pointer hover:bg-accent/50'}`}
                  >
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">{p.name}</span>
                        {p.builtIn && (
                          <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">
                            内置
                          </span>
                        )}
                        {!p.builtIn && (
                          <span className="text-xs text-muted-foreground">
                            {p.format === 'openai' ? 'OpenAI' : 'Anthropic'}
                          </span>
                        )}
                        {activeId === p.id && (
                          <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">
                            默认
                          </span>
                        )}
                      </div>
                      {!p.builtIn && (
                        <div className="text-xs text-muted-foreground">
                          <div className="truncate">{p.model || '未设置模型'}</div>
                          {p.baseUrl && <div className="text-[10px] break-all">{p.baseUrl}</div>}
                        </div>
                      )}
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
                      {!p.builtIn && (
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); startEdit(p); }} title="编辑">
                          <Settings className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {!p.builtIn && (
                        <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }} title="删除">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {/* Inline edit form */}
                  {editingId === p.id && (
                    <div className="mt-1.5 space-y-3 rounded-lg border border-primary/50 bg-primary/5 p-3 [&_input]:bg-background [&_select]:bg-background [&_textarea]:bg-background">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-provider">AI 提供商</Label>
                        <Input
                          id="edit-provider"
                          value={form.name}
                          onChange={(e) => setForm({ ...form, name: e.target.value })}
                          placeholder="如：OpenAI、DeepSeek、Anthropic..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-format">API 格式</Label>
                        <select
                          id="edit-format"
                          value={form.format}
                          onChange={(e) => setForm({ ...form, format: e.target.value as APIFormat })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          <option value="openai">OpenAI 兼容格式</option>
                          <option value="anthropic">Anthropic 兼容格式</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-baseurl">请求地址 / Base URL</Label>
                        <Input
                          id="edit-baseurl"
                          value={form.baseUrl}
                          onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                          placeholder="留空使用默认端点"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-apikey">API Key</Label>
                        <div className="relative">
                          <Input
                            id="edit-apikey"
                            type={showKey ? 'text' : 'password'}
                            value={form.apiKey}
                            onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                            placeholder={isEditingBuiltIn ? '已加密，留空保持不变' : 'sk-...'}
                            className="pr-8"
                          />
                          {!isEditingBuiltIn && (
                            <button
                              type="button"
                              onClick={() => setShowKey(!showKey)}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              tabIndex={-1}
                            >
                              {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          )}
                        </div>
                        {isEditingBuiltIn && (
                          <p className="text-[10px] text-muted-foreground">
                            内置模型密钥已加密存储，出于安全考虑不回显明文。留空保存将保留原密钥。
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-model">模型 ID</Label>
                        <Input
                          id="edit-model"
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
            <div className="space-y-3 rounded-lg border border-primary/50 bg-primary/5 p-3 [&_input]:bg-background [&_select]:bg-background [&_textarea]:bg-background">
              <div className="space-y-1.5">
                <Label htmlFor="add-provider">AI 提供商</Label>
                <Input
                  id="add-provider"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="如：OpenAI、DeepSeek、Anthropic..."
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-format">API 格式</Label>
                <select
                  id="add-format"
                  value={form.format}
                  onChange={(e) => setForm({ ...form, format: e.target.value as APIFormat })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="openai">OpenAI 兼容格式</option>
                  <option value="anthropic">Anthropic 兼容格式</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-baseurl">请求地址 / Base URL</Label>
                <Input
                  id="add-baseurl"
                  value={form.baseUrl}
                  onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
                  placeholder="留空使用默认端点"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-apikey">API Key</Label>
                <div className="relative">
                  <Input
                    id="add-apikey"
                    type={showKey ? 'text' : 'password'}
                    value={form.apiKey}
                    onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="add-model">模型 ID</Label>
                <Input
                  id="add-model"
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

          {/* Feature update */}
          <details className="group rounded-lg border border-border">
            <summary className="flex items-center justify-between px-3 py-2 text-sm font-medium cursor-pointer hover:bg-accent/50 transition-colors rounded-lg select-none">
              <span>功能更新</span>
              <span className="text-xs text-muted-foreground transition-transform group-open:rotate-180">&#9660;</span>
            </summary>
            <div className="px-3 pb-3 pt-1 text-xs text-muted-foreground space-y-1.5">
              <ReactMarkdown components={CHANGELOG_COMPONENTS}>{RECENT_CHANGELOG_MD}</ReactMarkdown>
            </div>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}
