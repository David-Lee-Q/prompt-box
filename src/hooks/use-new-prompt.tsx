import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useAppStore from '@/store/useAppStore';
import { toast } from '@/hooks/use-toast';
import SceneSelectDialog from '@/components/scene/SceneSelectDialog';

export function useNewPrompt() {
  const navigate = useNavigate();
  const [sceneSelectOpen, setSceneSelectOpen] = useState(false);

  const startNewPrompt = (sceneId: string) => {
    useAppStore.getState().setActiveScene(sceneId);
    navigate(`/prompts/new?sceneId=${sceneId}`);
  };

  const handleNewPrompt = () => {
    const currentSceneId = useAppStore.getState().activeSceneId;
    if (!currentSceneId) {
      toast({ title: '请先选择场景', variant: 'destructive' });
      setSceneSelectOpen(true);
      return;
    }
    navigate(`/prompts/new?sceneId=${currentSceneId}`);
  };

  const sceneSelectDialog = (
    <SceneSelectDialog
      open={sceneSelectOpen}
      onOpenChange={setSceneSelectOpen}
      onSelect={startNewPrompt}
    />
  );

  return { handleNewPrompt, sceneSelectDialog };
}
