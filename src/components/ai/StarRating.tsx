import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number | null;
  onChange?: (value: number | null) => void;
  readonly?: boolean;
  size?: 'sm' | 'md';
}

export default function StarRating({ value, onChange, readonly, size = 'md' }: StarRatingProps) {
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';

  const handleClick = (star: number) => {
    if (readonly || !onChange) return;
    onChange(value === star ? null : star);
  };

  return (
    <div className="inline-flex items-center gap-0.5" title={readonly ? `评分：${value ?? '无'}` : '点击评分'}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          onClick={() => handleClick(star)}
          className={`transition-colors ${
            readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'
          } ${
            value && star <= value
              ? 'text-yellow-500'
              : 'text-muted-foreground/30'
          }`}
        >
          <Star className={iconSize} fill={value && star <= value ? 'currentColor' : 'none'} />
        </button>
      ))}
    </div>
  );
}
