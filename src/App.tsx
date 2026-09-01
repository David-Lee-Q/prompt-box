import { useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route } from 'react-router-dom';
import { isExtension } from '@/utils/env';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DataManagementPage from '@/pages/DataManagementPage';
import PromptDetailPage from '@/pages/PromptDetailPage';
import AuthGuard from '@/components/auth/AuthGuard';
import ErrorBoundary from '@/components/layout/ErrorBoundary';
import GlobalNewPromptFab from '@/components/layout/GlobalNewPromptFab';
import { Toaster } from '@/components/ui/toaster';
import AISettings from '@/components/settings/AISettings';
import useSettingsStore from '@/store/settingsStore';
import useAuthStore from '@/store/authStore';

export default function App() {
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const checkSession = useAuthStore((s) => s.checkSession);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    loadSettings();
    checkSession();
  }, [loadSettings, checkSession]);

  const Router = isExtension() ? HashRouter : BrowserRouter;

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <AuthGuard>
                <HomePage />
              </AuthGuard>
            }
          />
          <Route
            path="/data"
            element={
              <AuthGuard>
                <DataManagementPage />
              </AuthGuard>
            }
          />
          <Route
            path="/prompts/:id"
            element={
              <AuthGuard>
                <PromptDetailPage />
              </AuthGuard>
            }
          />
        </Routes>
        {isAuthenticated && <GlobalNewPromptFab />}
      </Router>
      <AISettings />
      <Toaster />
    </ErrorBoundary>
  );
}
