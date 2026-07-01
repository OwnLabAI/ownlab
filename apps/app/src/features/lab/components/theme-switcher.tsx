'use client';

import { useEffect, useState } from 'react';
import { LaptopIcon, MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const THEMES = [
  { id: 'light', label: 'Light', icon: SunIcon },
  { id: 'dark', label: 'Dark', icon: MoonIcon },
  { id: 'system', label: 'System', icon: LaptopIcon },
] as const;

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="flex items-center gap-1 rounded-full border border-border/60 p-1">
        <div className="size-7 rounded-full bg-muted/60" />
        <div className="size-7 rounded-full bg-muted/60" />
        <div className="size-7 rounded-full bg-muted/60" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-border/60 bg-muted/30 p-1">
      {THEMES.map((item) => (
        <Button
          key={item.id}
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(
            'size-7 rounded-full',
            theme === item.id && 'bg-background text-foreground shadow-sm'
          )}
          onClick={() => setTheme(item.id)}
          aria-label={item.label}
          title={item.label}
        >
          <item.icon className="size-3.5" />
        </Button>
      ))}
    </div>
  );
}
