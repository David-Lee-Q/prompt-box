import { useState, useMemo, useCallback, useEffect } from 'react';
import { Send, ChevronDown } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { extractVariables, renderTemplate } from '@/hooks/useVariables';
import VariablePreview from '@/components/ai/VariablePreview';
import { insertPrompt, getPlatformTabs, getAvailablePlatforms, getPlatformLabel } from '@/services/insertService';
import type { VariableInfo } from '@/hooks/useVariables';

interface InsertDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content: string;
  title: string;
}

function VariableInput({ v, onChange }: {
  v: VariableInfo;
  onChange: (name: string, value: string) => void;
}) {
  return (
    <div key={v.name} className="space-y-1">
      <Label className="text-xs">{v.name}</Label>
      {v.type === 'boolean' ? (
        <label className="flex items-center gap-2 h-8 cursor-pointer">
          <input
            type="checkbox"
            checked={v.value === 'true'}
            onChange={(e) => onChange(v.name, e.target.checked ? 'true' : 'false')}
            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
          />
          <span className="text-xs text-muted-foreground">
            {v.value === 'true' ? '是' : '否'}
          </span>
        </label>
      ) : (
        <input
          type={v.type === 'number' ? 'number' : 'text'}
          value={v.value}
          onChange={(e) => onChange(v.name, e.target.value)}
          placeholder={v.name}
          className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
          min={v.min}
          max={v.max}
        />
      )}
    </div>
  );
}

export default function InsertDialog({ open, onOpenChange, content, title }: InsertDialogProps) {
  const platforms = useMemo(() => getAvailablePlatforms(), []);
  const [platform, setPlatform] = useState(platforms[0] || '');
  const [values, setValues] = useState<Record<string, string>>({});
  const [isInserting, setIsInserting] = useState(false);
  const [needsForce, setNeedsForce] = useState(false);

  // Reset state when dialog opens with new prompt
  useEffect(() => {
    if (open) {
      setValues({});
      setNeedsForce(false);
    }
  }, [open, content]);

  const defs = useMemo(() => extractVariables(content), [content]);
  const variables: VariableInfo[] = useMemo(
    () => defs.map((d) => ({ ...d, value: values[d.name] ?? '' })),
    [defs, values]
  );
  const resolved = useMemo(() => renderTemplate(content, variables), [content, variables]);

  const handleValueChange = useCallback((name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleInsert = async (force = false) => {
    setIsInserting(true);
    const result = await insertPrompt(platform, resolved, undefined, force);
    setIsInserting(false);

    if (result.success) {
      if (result.tabId) {
        const tab = await chrome.tabs.get(result.tabId);
        chrome.tabs.update(result.tabId, { active: true });
        if (tab.windowId) chrome.windows.update(tab.windowId, { focused: true, drawAttention: true });
      }
      toast({ title: '插入成功', description: `已填入 ${getPlatformLabel(platform)}` });
      onOpenChange(false);
    } else if (result.code === 'INPUT_NOT_EMPTY') {
      setNeedsForce(true);
    } else if (result.code === 'MULTIPLE_TABS') {
      // Show tab list for selection
      const tabs = await getPlatformTabs(platform);
      if (tabs.length > 0) {
        const tab = tabs.find((t) => t.active) || tabs[0];
        if (tab?.id != null) {
          const r = await insertPrompt(platform, resolved, tab.id, force);
          if (r.success) {
            if (tab?.id != null) chrome.tabs.update(tab.id, { active: true });
            toast({ title: '插入成功' });
            onOpenChange(false);
          } else {
            toast({ title: '插入失败', description: r.message, variant: 'destructive' });
          }
        }
      }
    } else {
      toast({ title: '插入失败', description: result.message, variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[calc(100dvh-2rem)] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            插入到 AI 平台
          </DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        {/* Platform selector — fixed */}
        {platforms.length > 1 && (
          <div className="space-y-1.5">
            <Label className="text-xs">目标平台</Label>
            <div className="relative">
              <select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm appearance-none cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                {platforms.map((p) => (
                  <option key={p} value={p}>{getPlatformLabel(p)}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}

        {/* Variable inputs — fixed, with own scroll if many */}
        {variables.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs">变量填充</Label>
            <div className="grid gap-2 max-h-32 overflow-y-auto">
              {variables.map((v) => (
                <VariableInput key={v.name} v={v} onChange={handleValueChange} />
              ))}
            </div>
          </div>
        )}

        {/* Preview — scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <VariablePreview rendered={resolved} />
        </div>

        {/* Overwrite warning */}
        {needsForce && (
          <p className="text-xs text-destructive shrink-0">
            目标平台输入框已有内容，是否覆盖？
          </p>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            size="sm"
            onClick={() => handleInsert(needsForce)}
            disabled={isInserting || !platform}
          >
            {isInserting ? '插入中...' : `插入到 ${getPlatformLabel(platform)}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
