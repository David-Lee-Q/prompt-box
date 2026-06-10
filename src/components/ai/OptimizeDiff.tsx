import { computeDiff, diffToLines } from '@/utils/diff';

interface OptimizeDiffProps {
  original: string;
  optimized: string;
}

export default function OptimizeDiff({ original, optimized }: OptimizeDiffProps) {
  const diffs = computeDiff(original, optimized);
  const lines = diffToLines(diffs);

  if (!optimized) return null;

  return (
    <div className="border rounded-md overflow-hidden font-mono text-sm max-h-60 overflow-y-auto">
      {lines.map((line, i) => {
        if (line.text === '\n') return <br key={i} />;
        return (
          <div
            key={i}
            className={`px-3 py-0.5 whitespace-pre-wrap ${
              line.type === 'insert'
                ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                : line.type === 'delete'
                ? 'bg-red-500/10 text-red-600 dark:text-red-400 line-through'
                : 'text-foreground'
            }`}
          >
            <span className="mr-2 select-none text-muted-foreground w-3 inline-block">
              {line.type === 'insert' ? '+' : line.type === 'delete' ? '-' : ' '}
            </span>
            {line.text}
          </div>
        );
      })}
    </div>
  );
}
