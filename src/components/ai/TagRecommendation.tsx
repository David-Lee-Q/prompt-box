import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TagSuggestion } from '@/services/tagSuggest';

interface TagRecommendationProps {
  suggestions: TagSuggestion[];
  onApply: (tags: string[]) => void;
  onDismiss: () => void;
}

export default function TagRecommendation({
  suggestions,
  onApply,
  onDismiss,
}: TagRecommendationProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    setSelected(new Set(suggestions.map((s) => s.tag)));
  }, [suggestions]);

  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), 5000);
    return () => clearTimeout(timer);
  }, []);

  const toggle = (tag: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  return (
    <div className="rounded-lg border p-3 space-y-2 bg-background">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">推荐标签</span>
        <button onClick={onDismiss} className="text-muted-foreground hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s.tag}
            onClick={() => toggle(s.tag)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-colors ${
              selected.has(s.tag)
                ? 'bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {s.tag}
            <span className="text-muted-foreground/60">
              ({s.source === 'keyword' ? '内容匹配' : '标签匹配'})
            </span>
          </button>
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          onClick={() => onApply(Array.from(selected))}
          disabled={selected.size === 0}
        >
          应用选中标签
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          忽略
        </Button>
      </div>
    </div>
  );
}
