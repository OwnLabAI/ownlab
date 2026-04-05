import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { TeamPageContent } from './content';

type Props = {
  params: Promise<{ name: string }>;
};

export default async function TeamPage({ params }: Props) {
  const { name } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <TeamPageContent name={name} />
    </Suspense>
  );
}
