'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { getWwwUrl } from '@/lib/urls';
import { useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

export function DesktopLoginCard() {
  const searchParams = useSearchParams();
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = useMemo(() => {
    return (
      searchParams.get('callbackUrl') ||
      (typeof window !== 'undefined' ? `${window.location.origin}/lab/workspaces` : '/lab/workspaces')
    );
  }, [searchParams]);

  const handleContinue = async () => {
    setIsPending(true);
    setError(null);
    try {
      if (window.ownlabDesktop) {
        await window.ownlabDesktop.auth.login(callbackUrl);
        return;
      }

      const loginUrl = new URL('/auth/login', getWwwUrl());
      loginUrl.searchParams.set('callbackUrl', callbackUrl);
      window.location.assign(loginUrl.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Failed to open desktop login flow');
      setIsPending(false);
    }
  };

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <Card className="w-full max-w-sm border border-border shadow-xs">
        <CardHeader className="flex flex-col items-center gap-1 pb-2">
          <div className="mb-1 flex h-10 items-center">
            <img
              src="/icon.svg"
              alt="OwnLab"
              className="block size-8 rounded-md dark:hidden"
            />
            <img
              src="/icon-dark.svg"
              alt="OwnLab"
              className="hidden size-8 rounded-md dark:block"
            />
          </div>
          <CardDescription>Sign in to OwnLab</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Button
            className="w-full"
            size="lg"
            onClick={() => void handleContinue()}
            disabled={isPending}
          >
            {isPending ? 'Opening browser...' : 'Continue in browser'}
          </Button>
          {error && (
            <p className="text-center text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
