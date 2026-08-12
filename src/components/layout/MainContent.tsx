import { ReactNode } from 'react';

interface MainContentProps {
  children: ReactNode;
}

export default function MainContent({ children }: MainContentProps) {
  return (
    <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 main-content-pb">
      {children}
    </main>
  );
}
