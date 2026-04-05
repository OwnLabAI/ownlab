'use client';

import { Logo } from '@/components/layout/logo';
import { Button } from '@/components/ui/button';
import { useLocaleRouter } from '@/i18n/navigation';
import { Loader2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';

export default function Error({ reset }: { reset: () => void }) {
  const t = useTranslations('ErrorPage');
  const router = useLocaleRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8">
      <Logo className="size-12" />

      <h1 className="text-center text-2xl">{t('title')}</h1>

      <div className="flex items-center gap-4">
        <Button
          type="submit"
          variant="default"
          className="cursor-pointer"
          disabled={isPending}
          onClick={() => {
            startTransition(() => {
              router.refresh();
              reset();
            });
          }}
        >
          {isPending ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : null}
          {t('tryAgain')}
        </Button>

        <Button
          type="submit"
          variant="outline"
          className="cursor-pointer"
          onClick={() => router.push('/')}
        >
          {t('backToHome')}
        </Button>
      </div>
    </div>
  );
}
