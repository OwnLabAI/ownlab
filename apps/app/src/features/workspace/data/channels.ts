import {
  ensureDefaultChannel,
  fetchWorkspaceChannels,
  type Channel,
} from '@/lib/api';

export async function loadWorkspaceChannels(workspaceId: string): Promise<Channel[]> {
  let channels = await fetchWorkspaceChannels(workspaceId);
  if (channels.length === 0) {
    const defaultChannel = await ensureDefaultChannel(workspaceId);
    channels = [defaultChannel];
  }

  return channels;
}

export function getPreferredWorkspaceChannel(
  channels: Channel[],
  workspaceId: string,
  selectedChannelId: string | null | undefined,
) {
  if (selectedChannelId) {
    const selected = channels.find((channel) => channel.id === selectedChannelId);
    if (selected) {
      return selected;
    }
  }

  return channels.find((channel) => channel.scopeRefId === workspaceId) ?? channels[0] ?? null;
}
