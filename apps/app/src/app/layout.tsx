import type { ReactNode } from 'react';

import {
  fontBricolageGrotesque,
  fontCommissioner,
  fontNotoSans,
  fontNotoSansMono,
  fontNotoSerif,
} from '@/assets/fonts';
import { DesktopEnvironment } from '@/components/desktop/desktop-environment';
import { Toaster } from '@/components/ui/sonner';
import { cn } from '@/lib/utils';

import '@/styles/globals.css';
import { Providers } from './providers';

export const metadata = {
  title: 'OwnLab',
  description: 'OwnLab - Your local AI workspace',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="font-sans">
      <body
        suppressHydrationWarning
        className={cn(
          'size-full antialiased',
          fontCommissioner.className,
          fontNotoSans.variable,
          fontNotoSerif.variable,
          fontNotoSansMono.variable,
          fontBricolageGrotesque.variable
        )}
      >
        <Providers>
          <DesktopEnvironment />
          {children}
          <Toaster richColors position="top-right" offset={64} />
        </Providers>
      </body>
    </html>
  );
}
