import { useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  suggestions: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export default function TagInput({ tags, suggestions, onChange, placeholder = '输入标签后回车' }: TagInputProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredSuggestions = suggestions.filter(
    (s) => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
  );

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInput('');
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    onChange(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === ',' && input) {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]!);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 p-2 border rounded-md bg-background min-h-[36px]">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="hover:bg-primary/20 rounded-full p-0.5"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <div className="relative flex-1 min-w-[120px]">
        <input
          value={input}
          onChange={(e) => { setInput(e.target.value); setShowSuggestions(true); }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="border-0 bg-transparent outline-none text-sm w-full p-0.5"
        />
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute top-full left-0 z-10 mt-1 w-full bg-popover border rounded-md shadow-md max-h-32 overflow-auto">
            {filteredSuggestions.slice(0, 8).map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(s)}
                className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
