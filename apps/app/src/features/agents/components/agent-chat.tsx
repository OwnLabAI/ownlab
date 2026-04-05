'use client';

import type { Channel } from '@/lib/api';
import { AgentChatView } from './agent-chat-view';

type Props = {
  agent: {
    id: string;
    name: string;
    adapterType: string;
  };
  channel: Channel;
  sessionId: string;
  onChannelActivity?: () => void;
};

export function AgentChat({ agent, channel, sessionId, onChannelActivity }: Props) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <AgentChatView
        channel={channel}
        sessionId={sessionId}
        placeholder={`Message ${agent.name}...`}
        onChannelActivity={onChannelActivity}
      />
    </div>
  );
}
