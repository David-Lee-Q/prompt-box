import { useState, useEffect, useRef } from 'react';
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
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm font-medium">推荐标签</span>

      {suggestions.map((s) => (
        <button
          key={s.tag}
          onClick={() => toggle(s.tag)}
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors ${
            selected.has(s.tag)
              ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          }`}
        >
          {s.tag}
        </button>
      ))}

      <Button
        size="sm"
        onClick={() => onApply(Array.from(selected))}
        disabled={selected.size === 0}
        className="h-6 text-xs px-2"
      >
        应用选中标签
      </Button>
      <Button size="sm" variant="ghost" onClick={onDismiss} className="h-6 text-xs px-2">
        忽略
      </Button>
    </div>
  );
}
