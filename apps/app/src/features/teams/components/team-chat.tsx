'use client';

import type { Channel } from '@/lib/api';
import { TeamChatView } from './team-chat-view';

type TeamRecord = {
  id: string;
  name: string;
};

export function TeamChat({
  team,
  channel,
}: {
  team: TeamRecord;
  channel: Channel;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TeamChatView channel={channel} placeholder={`Message ${team.name}...`} />
    </div>
  );
}
