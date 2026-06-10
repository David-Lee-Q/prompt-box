import { Star, Clock, FileText, Tag } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { formatDate } from '@/utils/helpers';
import { getVersion } from '@/services/versionService';
import HighlightText from '@/components/search/HighlightText';
import useAppStore from '@/store/useAppStore';
import type { Prompt } from '@/types';
import { useState, useEffect } from 'react';

interface PromptCardProps {
  prompt: Prompt;
  onClick: () => void;
  onToggleStar: () => void;
}

export default function PromptCard({ prompt, onClick, onToggleStar }: PromptCardProps) {
  const searchQuery = useAppStore((s) => s.searchQuery);
  const [versionStr, setVersionStr] = useState('');

  useEffect(() => {
    if (prompt.currentVersionId) {
      getVersion(prompt.currentVersionId).then((v) => {
        if (v) setVersionStr(v.version);
      });
    }
  }, [prompt.currentVersionId]);

  return (
    <Card
      className="cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-200 group active:scale-[0.98]"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <h3 className="font-bold text-sm truncate">
              <HighlightText text={prompt.name} highlight={searchQuery} />
            </h3>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar();
            }}
            className={`flex-shrink-0 p-1 rounded transition-colors ${
              prompt.isStarred
                ? 'text-yellow-500 hover:text-yellow-600'
                : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-foreground'
            }`}
          >
            <Star className="h-4 w-4" fill={prompt.isStarred ? 'currentColor' : 'none'} />
          </button>
        </div>

        <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
          <HighlightText text={prompt.content || '暂无内容'} highlight={searchQuery} />
        </p>

        {prompt.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {prompt.tags.slice(0, 3).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-primary/5 text-primary/70">
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
            {prompt.tags.length > 3 && (
              <span className="text-[10px] text-muted-foreground">+{prompt.tags.length - 3}</span>
            )}
          </div>
        )}
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          {versionStr && (
            <span className="font-mono text-primary/60">{versionStr}</span>
          )}
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>{formatDate(prompt.updatedAt)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
