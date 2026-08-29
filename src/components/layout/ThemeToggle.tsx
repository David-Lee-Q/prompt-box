import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';

const THEME_ORDER = ['light', 'dark', 'system'] as const;

type Theme = (typeof THEME_ORDER)[number];

const ICONS: Record<Theme, { icon: React.ReactNode; label: string }> = {
  light: { icon: <Sun className="h-4 w-4" />, label: '浅色模式' },
  dark: { icon: <Moon className="h-4 w-4" />, label: '深色模式' },
  system: { icon: <Monitor className="h-4 w-4" />, label: '跟随系统' },
};

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const handleClick = () => {
    const idx = THEME_ORDER.indexOf(theme as Theme);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length]!;
    setTheme(next);
  };

  const { icon, label } = ICONS[theme as Theme] ?? ICONS.system;

  return (
    <button
      onClick={handleClick}
      title={`主题：${label}（点击切换）`}
      className="h-10 w-10 sm:h-9 sm:w-9 inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {icon}
    </button>
  );
}
