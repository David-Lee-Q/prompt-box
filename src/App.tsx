import { BrowserRouter, Routes, Route } from 'react-router-dom';
import HomePage from '@/pages/HomePage';
import PromptDetailPage from '@/pages/PromptDetailPage';
import ErrorBoundary from '@/components/layout/ErrorBoundary';
import { Toaster } from '@/components/ui/toaster';

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/prompts/:id" element={<PromptDetailPage />} />
        </Routes>
      </BrowserRouter>
      <Toaster />
    </ErrorBoundary>
  );
}
