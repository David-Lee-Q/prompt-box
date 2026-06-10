import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModelOutputCardProps {
  providerName: string;
  model: string;
  output: string;
  latency?: number;
  error?: string;
  isLoading: boolean;
  onCopy: (text: string) => void;
}

export default function ModelOutputCard({
  providerName,
  model,
  output,
  latency,
  error,
  isLoading,
  onCopy,
}: ModelOutputCardProps) {
  return (
    <div className="rounded-lg border p-3 flex flex-col min-w-[200px] flex-1 min-h-0">
      <div className="flex items-center justify-between mb-2 flex-shrink-0">
        <div className="min-w-0">
          <div className="text-sm font-bold truncate">{providerName}</div>
          <div className="text-xs text-muted-foreground truncate">{model}</div>
        </div>
        {latency != null && !isLoading && (
          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">{(latency / 1000).toFixed(1)}s</span>
        )}
      </div>

      {isLoading && !output && (
        <div className="text-xs text-muted-foreground animate-pulse">等待响应...</div>
      )}

      {error && (
        <div className="rounded bg-destructive/10 p-2 text-xs text-destructive mb-2 flex-shrink-0">{error}</div>
      )}

      {output && (
        <>
          <div className="flex-1 min-h-0 rounded bg-muted/30 p-2 overflow-y-auto mb-2">
            <pre className="text-xs whitespace-pre-wrap font-sans">{output}</pre>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onCopy(output)} className="text-xs flex-shrink-0">
            <Copy className="h-3 w-3 mr-1" />复制此输出
          </Button>
        </>
      )}
    </div>
  );
}
