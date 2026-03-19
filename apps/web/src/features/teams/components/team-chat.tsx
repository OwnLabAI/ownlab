'use client';

import { TeamChatView } from './team-chat-view';

type TeamRecord = {
  id: string;
  name: string;
};

type ChannelRecord = {
  id: string;
  workspaceId: string;
  scopeType: string;
  scopeRefId: string | null;
  name: string;
  title: string | null;
  description: string | null;
};

export function TeamChat({
  team,
  channel,
}: {
  team: TeamRecord;
  channel: ChannelRecord;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <TeamChatView channel={channel} placeholder={`Message ${team.name}...`} />
    </div>
  );
}
