import Link from 'next/link';

import { Button } from '@/components/ui/button';

/**
 * Renders when a route is not found (e.g. /unknown).
 * https://nextjs.org/docs/app/api-reference/file-conventions/not-found
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <>
        <img
          src="/logo-name.svg"
          alt="OwnLab"
          className="h-12 w-auto dark:hidden"
        />
        <img
          src="/logo-name-dark.svg"
          alt="OwnLab"
          className="hidden h-12 w-auto dark:block"
        />
      </>

      <h1 className="text-4xl font-bold">Page not found</h1>

      <p className="max-w-md text-center text-xl font-medium text-muted-foreground">
        The page you’re looking for doesn’t exist or has been moved.
      </p>

      <Button asChild size="lg" className="cursor-pointer">
        <Link href="/lab">Back to Lab</Link>
      </Button>
    </div>
  );
}
