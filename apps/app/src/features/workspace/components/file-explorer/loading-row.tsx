import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { getItemPadding } from './constants';

export function LoadingRow({
  className,
  level = 0,
}: {
  className?: string;
  level?: number;
}) {
  return (
    <div
      className={cn(
        'flex h-10 items-center text-muted-foreground',
        className,
      )}
      style={{ paddingLeft: getItemPadding(level, true) }}
    >
      <Spinner className="ml-0.5 size-4 text-ring" />
    </div>
  );
}
