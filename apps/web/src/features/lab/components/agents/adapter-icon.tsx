'use client';

import {
  Bot,
  Code,
  Gem,
  MousePointer2,
  Square,
  Sparkles,
  Terminal,
  Users,
} from 'lucide-react';
import { AGENT_ADAPTER_LOGOS } from './constants';
import { cn } from '@/lib/utils';

const FALLBACK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  claude_local: Sparkles,
  codex_local: Code,
  gemini_local: Gem,
  opencode_local: Square,
  pi_local: Terminal,
  cursor: MousePointer2,
};

type Props = {
  adapterKey: string;
  className?: string;
};

export function AdapterIcon({ adapterKey, className }: Props) {
  const logoPath = AGENT_ADAPTER_LOGOS[adapterKey];
  const FallbackIcon = FALLBACK_ICONS[adapterKey];

  if (logoPath) {
    return (
      <img
        src={logoPath}
        alt=""
        className={cn('size-5 shrink-0 object-contain', className)}
        aria-hidden
      />
    );
  }

  if (FallbackIcon) {
    return <FallbackIcon className={cn('size-5 shrink-0 text-muted-foreground', className)} />;
  }

  return <Users className={cn('size-5 shrink-0 text-muted-foreground', className)} />;
}
