import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';

export default function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <div className="flex items-center border rounded-md overflow-hidden">
      <button
        onClick={() => setTheme('light')}
        className={`p-1.5 transition-colors ${
          resolvedTheme === 'light'
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
        }`}
        title="浅色模式"
      >
        <Sun className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('dark')}
        className={`p-1.5 transition-colors ${
          resolvedTheme === 'dark'
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
        }`}
        title="深色模式"
      >
        <Moon className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setTheme('system')}
        className={`p-1.5 transition-colors ${
          theme === 'system'
            ? 'bg-accent text-foreground'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
        }`}
        title="跟随系统"
      >
        <Monitor className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
