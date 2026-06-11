import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { isExtension } from '@/utils/env';
import HomePage from '@/pages/HomePage';
import PromptDetailPage from '@/pages/PromptDetailPage';
import ErrorBoundary from '@/components/layout/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';
import AISettings from '@/components/settings/AISettings';
import useSettingsStore from '@/store/settingsStore';

export default function App() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const Router = isExtension() ? HashRouter : BrowserRouter;

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/prompts/:id" element={<PromptDetailPage />} />
        </Routes>
      </Router>
      <AISettings />
      <Toaster />
    </ErrorBoundary>
  );
}
