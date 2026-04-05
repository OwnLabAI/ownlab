'use client';

import { TooltipProvider } from '@/components/ui/tooltip';
import { websiteConfig } from '@/config/website';
import { ThemeProvider } from 'next-themes';
import type { ReactNode } from 'react';

interface ProvidersProps {
  children: ReactNode;
  locale: string;
}

export function Providers({ children }: ProvidersProps) {
  const defaultMode = websiteConfig.ui.mode?.defaultMode ?? 'system';

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme={defaultMode}
      enableSystem
      disableTransitionOnChange
    >
      <div className="theme-neutral min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
      </div>
    </ThemeProvider>
  );
}
