'use client';

import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';

const THEME_STORAGE_KEY = 'ownlab-theme';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      storageKey={THEME_STORAGE_KEY}
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </ThemeProvider>
  );
}
