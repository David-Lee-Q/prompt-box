import { useEffect, useState } from 'react';
import { Check, FolderOpen } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import useAppStore from '@/store/useAppStore';
import { db } from '@/db';
import { getSessionUser } from '@/store/authStore';
import { PUBLIC_USER_ID } from '@/constants';

interface SceneSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (sceneId: string) => void;
}

export default function SceneSelectDialog({ open, onOpenChange, onSelect }: SceneSelectDialogProps) {
  const scenes = useAppStore((s) => s.scenes);
  const activeSceneId = useAppStore((s) => s.activeSceneId);
  const [promptCounts, setPromptCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const user = getSessionUser();
    const query = user
      ? db.prompts.where('userId').anyOf([user.id, PUBLIC_USER_ID]).toArray()
      : db.prompts.toArray();
    query.then((all) => {
      if (cancelled) return;
      const counts: Record<string, number> = {};
      all.forEach((p) => {
        counts[p.sceneId] = (counts[p.sceneId] || 0) + 1;
      });
      setPromptCounts(counts);
    });
    return () => {
      cancelled = true;
    };
  }, [open, scenes]);

  const handleSelect = (sceneId: string) => {
    onSelect(sceneId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>选择场景</DialogTitle>
          <DialogDescription>提示词将创建到所选场景下</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5 -mx-2 px-2 max-h-[60dvh] overflow-y-auto">
          {scenes.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <FolderOpen className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">暂无场景，请先创建场景</p>
            </div>
          ) : (
            scenes.map((scene) => (
              <button
                key={scene.id}
                onClick={() => handleSelect(scene.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-lg border text-left transition-colors ${
                  activeSceneId === scene.id
                    ? 'bg-primary/5 border-primary/20'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <span
                  className="w-1.5 h-6 rounded-full flex-shrink-0"
                  style={{ backgroundColor: scene.color }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium truncate">{scene.name}</span>
                  <span className="block text-xs text-muted-foreground/70">
                    {promptCounts[scene.id] ?? 0} 条提示词
                  </span>
                </span>
                {activeSceneId === scene.id && (
                  <Check className="h-4 w-4 text-primary flex-shrink-0" />
                )}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
