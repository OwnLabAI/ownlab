'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo } from 'react';
import dynamic from 'next/dynamic';

const LazyStreamdownRenderer = dynamic(
  () =>
    import('./streamdown-renderer').then((mod) => ({
      default: mod.StreamdownRenderer,
    })),
  {
    loading: () => <div className="text-sm text-muted-foreground">Loading…</div>,
    ssr: false,
  },
);

type ResponseProps = {
  children?: string;
  className?: string;
  components?: ComponentProps<
    typeof import('./streamdown-renderer').StreamdownRenderer
  >['components'];
};

export const Response = memo(
  ({ className, ...props }: ResponseProps) => (
    <LazyStreamdownRenderer
      className={cn(
        'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className
      )}
      {...props}
    />
  ),
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

Response.displayName = 'Response';
