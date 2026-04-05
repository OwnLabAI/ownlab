import {
  fontBricolageGrotesque,
  fontCommissioner,
  fontNotoSans,
  fontNotoSansMono,
  fontNotoSerif,
} from '@/assets/fonts';
import { LOCALE_COOKIE_NAME, routing } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { cookies } from 'next/headers';
import type { ReactNode } from 'react';

import '@/styles/globals.css';

interface Props {
  children: ReactNode;
}

/**
 * Since we have a `not-found.tsx` page on the root, a layout file
 * is required, even if it's just passing children through.
 *
 * https://next-intl.dev/docs/environments/error-files#catching-non-localized-requests
 */
export default async function RootLayout({ children }: Props) {
  const cookieStore = await cookies();
  const locale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const lang = routing.locales.includes(locale ?? '')
    ? locale!
    : routing.defaultLocale;

  return (
    <html suppressHydrationWarning lang={lang}>
      <body
        suppressHydrationWarning
        className={cn(
          'size-full antialiased',
          fontCommissioner.className,
          fontNotoSans.variable,
          fontNotoSerif.variable,
          fontNotoSansMono.variable,
          fontBricolageGrotesque.variable,
        )}
      >
        {children}
      </body>
    </html>
  );
}
