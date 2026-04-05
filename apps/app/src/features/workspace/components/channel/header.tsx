'use client';

import { Check, ChevronDown, Hash } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Channel } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function getChannelLabel(channel: Channel) {
  return channel.title?.trim() || channel.name;
}

interface ChannelHeaderProps {
  title: string;
  channels: Channel[];
  selectedChannelId: string;
  onSelectChannel: (channelId: string) => void;
  actions?: ReactNode;
}

export function ChannelHeader({
  title,
  channels,
  selectedChannelId,
  onSelectChannel,
  actions,
}: ChannelHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-start justify-between gap-3 px-4 pt-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="h-auto max-w-[min(26rem,100%)] gap-1.5 rounded-full px-2.5 py-1.5 text-sm font-medium"
          >
            <span className="truncate">{title}</span>
            <ChevronDown className="size-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-80 w-72">
          {channels.map((channel) => {
            const active = channel.id === selectedChannelId;
            return (
              <DropdownMenuItem
                key={channel.id}
                onSelect={() => onSelectChannel(channel.id)}
                className="gap-3"
              >
                <Hash className="size-4 text-muted-foreground" />
                <span className="flex-1 truncate">{getChannelLabel(channel)}</span>
                <Check className={`size-4 ${active ? 'opacity-100' : 'opacity-0'}`} />
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
