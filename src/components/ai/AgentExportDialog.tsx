import { useState, useMemo } from 'react';
import { Copy, Download, FileCode } from 'lucide-react';
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
import { copyToClipboard } from '@/utils/clipboard';
import { exportAsAgentTool } from '@/utils/agent-export';
import { extractVariables } from '@/utils/variables';
import type { Prompt, Version } from '@/types';
import type { AgentExportFormat } from '@/types/ai';

const FORMATS: { value: AgentExportFormat; label: string }[] = [
  { value: 'openai-fc', label: 'OpenAI Function Calling' },
  { value: 'anthropic-tools', label: 'Anthropic Tool Use' },
  { value: 'openai-sdk', label: 'OpenAI SDK (TypeScript)' },
  { value: 'langchain', label: 'LangChain Tool' },
];

interface AgentExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: Prompt;
  version?: Version;
}

export default function AgentExportDialog({ open, onOpenChange, prompt, version }: AgentExportDialogProps) {
  const [format, setFormat] = useState<AgentExportFormat>('openai-fc');
  const [includeHandler, setIncludeHandler] = useState(false);

  const variables = useMemo(() => extractVariables(prompt.content), [prompt.content]);

  const result = useMemo(
    () => exportAsAgentTool(prompt, format, includeHandler, version),
    [prompt, format, includeHandler, version]
  );

  const handleCopy = async () => {
    const ok = await copyToClipboard(result.content);
    toast({ title: ok ? '已复制到剪贴板' : '复制失败', variant: ok ? 'success' : 'destructive' });
  };

  const handleDownload = () => {
    const blob = new Blob([result.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: '已下载', description: result.filename });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            导出为 Agent 工具
          </DialogTitle>
          <DialogDescription>
            将提示词转换为 Agent 框架可用的工具定义
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 min-h-0">
          {/* Prompt info */}
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{prompt.name}</span>
            {version && <span className="ml-2 font-mono text-xs">{version.version}</span>}
            {variables.length > 0 && (
              <span className="ml-2">
                {variables.map((v) => `{${v.name}}`).join(' ')}
              </span>
            )}
          </div>

          {/* Format selector */}
          <div className="space-y-2">
            <Label className="text-xs">导出格式</Label>
            <div className="grid grid-cols-2 gap-2">
              {FORMATS.map((f) => (
                <label
                  key={f.value}
                  className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm cursor-pointer transition-colors ${
                    format === f.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'hover:bg-accent'
                  }`}
                >
                  <input
                    type="radio"
                    name="exportFormat"
                    value={f.value}
                    checked={format === f.value}
                    onChange={() => setFormat(f.value)}
                    className="sr-only"
                  />
                  {f.label}
                </label>
              ))}
            </div>
          </div>

          {/* Options */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={includeHandler}
              onChange={(e) => setIncludeHandler(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            包含 Handler 占位代码
          </label>

          {/* Preview */}
          <div className="space-y-1 flex-1 min-h-0 flex flex-col">
            <Label className="text-xs">预览</Label>
            <pre className="flex-1 min-h-[200px] max-h-[300px] overflow-auto rounded-md border bg-muted/30 p-3 text-xs font-mono whitespace-pre-wrap break-all">
              {result.content}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button size="sm" variant="outline" onClick={handleCopy}>
            <Copy className="h-3.5 w-3.5 mr-1" />
            复制
          </Button>
          <Button size="sm" onClick={handleDownload}>
            <Download className="h-3.5 w-3.5 mr-1" />
            下载文件
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
