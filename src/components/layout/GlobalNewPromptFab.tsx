import { Plus } from 'lucide-react';
import { useNewPrompt } from '@/hooks/use-new-prompt';

export default function GlobalNewPromptFab() {
  const { handleNewPrompt, sceneSelectDialog } = useNewPrompt();

  return (
    <>
      <button
        onClick={handleNewPrompt}
        className="sm:hidden fixed right-4 z-40 p-3 min-h-[44px] min-w-[44px] bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors active:scale-[0.95]"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom, 0px))' }}
        title="新建提示词"
      >
        <Plus className="h-5 w-5" />
      </button>
      {sceneSelectDialog}
    </>
  );
}
