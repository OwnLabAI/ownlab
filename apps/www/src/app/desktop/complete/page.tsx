'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Logo } from '@/components/layout/logo';
import { authClient } from '@/lib/auth-client';
import { getBaseUrl } from '@/lib/urls/urls';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const DESKTOP_COMPLETE_URL = 'ownlab://auth/complete';

export default function DesktopCompletePage() {
  const searchParams = useSearchParams();
  const { data: session, isPending } = authClient.useSession();
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [hasAttemptedDesktopOpen, setHasAttemptedDesktopOpen] = useState(false);

  const appCallbackUrl = useMemo(
    () => searchParams.get('appCallbackUrl') || 'http://localhost:3000/lab/workspaces',
    [searchParams],
  );
  const desktopCallbackUrl = useMemo(
    () => searchParams.get('desktopCallbackUrl') || null,
    [searchParams],
  );

  useEffect(() => {
    if (isPending || !session?.user || !desktopCallbackUrl || status === 'sending' || status === 'sent') {
      return;
    }

    const send = async () => {
      setStatus('sending');
      try {
        const response = await fetch(desktopCallbackUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            callbackUrl: appCallbackUrl,
            session: {
              user: session.user,
              session: session.session,
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`Desktop callback failed with ${response.status}`);
        }
        setStatus('sent');
      } catch (error) {
        console.error('[ownlab-www] desktop completion failed:', error);
        setStatus('error');
      }
    };

    void send();
  }, [appCallbackUrl, desktopCallbackUrl, isPending, session, status]);

  useEffect(() => {
    if (status !== 'sent' || hasAttemptedDesktopOpen) {
      return;
    }

    setHasAttemptedDesktopOpen(true);
    window.location.assign(DESKTOP_COMPLETE_URL);
  }, [hasAttemptedDesktopOpen, status]);

  const handleContinue = () => {
    if (session?.user && desktopCallbackUrl) {
      setStatus('idle');
      return;
    }

    const loginUrl = new URL('/auth/login', getBaseUrl());
    const completionUrl = new URL('/desktop/complete', getBaseUrl());
    completionUrl.searchParams.set('appCallbackUrl', appCallbackUrl);
    if (desktopCallbackUrl) {
      completionUrl.searchParams.set('desktopCallbackUrl', desktopCallbackUrl);
    }
    loginUrl.searchParams.set('callbackUrl', completionUrl.toString());
    window.location.assign(loginUrl.toString());
  };

  const handleReturnToDesktop = () => {
    window.location.assign(DESKTOP_COMPLETE_URL);
  };

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 md:p-10">
      <Card className="w-full max-w-sm border border-border shadow-xs">
        <CardHeader className="flex flex-col items-center gap-1 pb-2 text-center">
          <Logo className="mb-2" />
          <CardDescription>
            {session?.user ? 'Signed in to OwnLab' : 'Sign in to OwnLab'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          <Button className="w-full" size="lg" onClick={handleContinue}>
            {session?.user ? 'Retry desktop handoff' : 'Continue to sign in'}
          </Button>
          {status === 'sent' && (
            <Button className="w-full" variant="outline" onClick={handleReturnToDesktop}>
              Return to OwnLab Desktop
            </Button>
          )}
          {status === 'error' && (
            <p className="text-center text-sm text-destructive">
              Could not reach the desktop app. Make sure OwnLab Desktop is running, then try again.
            </p>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
