'use client';

import { cn } from '@/lib/utils';
import Image from 'next/image';

export function Logo({ className }: { className?: string }) {
  return (
    <Image
      src="/icon.svg"
      alt="Logo"
      title="Logo"
      width={44}
      height={41}
      className={cn('size-8 rounded-md', className)}
    />
  );
}
