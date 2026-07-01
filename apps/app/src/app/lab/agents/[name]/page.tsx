import { Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import { AgentPageContent } from './content';

type Props = {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ session?: string }>;
};

export default async function AgentPage({ params, searchParams: _searchParams }: Props) {
  const { name } = await params;
  await _searchParams;

  return (
    <Suspense
      fallback={
        <div className="flex h-full items-center justify-center">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AgentPageContent name={name} />
    </Suspense>
  );
}
