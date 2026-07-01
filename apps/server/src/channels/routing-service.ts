import type { Db } from "@ownlab/db";
import { createChannelService } from "./service.js";

export interface ResolveChannelRoutingInput {
  channelId?: string;
  agentId?: string;
  workspaceId?: string;
  scopeType?: "agent_dm" | "task" | "workspace" | "team";
  taskId?: string;
  assigneeAgentId?: string;
  teamId?: string;
  content?: string;
  mentions?: Array<{
    id: string;
    type: "agent";
    label: string;
  }>;
}

export interface ChannelResponsePlan {
  channel: Awaited<ReturnType<ReturnType<typeof createChannelService>["getChannelById"]>>;
  channelMembers: Awaited<
    ReturnType<ReturnType<typeof createChannelService>["listChannelMembers"]>
  >;
  participantMembers: Awaited<
    ReturnType<ReturnType<typeof createChannelService>["listChannelAgentMembers"]>
  >;
}

export function createChannelRoutingService(db: Db) {
  const channelService = createChannelService(db);

  function normalizeMentionToken(value: string) {
    return value.trim().toLowerCase().replace(/^@+/, "");
  }

  function extractMentionTokens(content: string | undefined) {
    if (!content) {
      return [];
    }

    const matches = content.match(/@([A-Za-z0-9._-]+)/g) ?? [];
    return matches.map((match) => normalizeMentionToken(match));
  }

  async function selectParticipantMembers(
    channel: NonNullable<Awaited<ReturnType<typeof resolveChannel>>>,
    content: string | undefined,
    mentions: ResolveChannelRoutingInput["mentions"],
  ) {
    const channelMembers = await channelService.listChannelMembers(channel.id);
    const agentMembers = await channelService.listChannelAgentMembers(channel.id);
    const mentionTokens = new Set(extractMentionTokens(content));
    const mentionIds = new Set(
      (mentions ?? [])
        .filter((mention) => mention.type === "agent" && typeof mention.id === "string")
        .map((mention) => mention.id),
    );

    if (agentMembers.length === 0) {
      return { channelMembers, participantMembers: [] };
    }

    const mentionedAgents = agentMembers.filter((member) => {
      const name = typeof member.name === "string" ? normalizeMentionToken(member.name) : "";
      const actorId = normalizeMentionToken(member.actorId);
      return mentionIds.has(member.actorId) || (name && mentionTokens.has(name)) || mentionTokens.has(actorId);
    });

    if (mentionedAgents.length > 0) {
      return {
        channelMembers,
        participantMembers: mentionedAgents,
      };
    }

    if (channel.scopeType === "workspace") {
      return {
        channelMembers,
        participantMembers: agentMembers[0] ? [agentMembers[0]] : [],
      };
    }

    return {
      channelMembers,
      participantMembers: [agentMembers[0]],
    };
  }

  async function resolveChannel(input: ResolveChannelRoutingInput) {
    let channel = input.channelId
      ? await channelService.getChannelById(input.channelId)
      : null;

    if (!channel) {
      if (!input.workspaceId) {
        throw new Error("workspaceId is required when channelId is not provided");
      }

      if (input.scopeType === "task" && input.taskId) {
        channel = await channelService.ensureTaskChannel(input.workspaceId, input.taskId);
      } else if (input.scopeType === "team" && input.teamId) {
        channel = await channelService.ensureTeamChannel(input.workspaceId, input.teamId);
      } else if (input.scopeType === "workspace") {
        channel = await channelService.ensureDefaultWorkspaceChannel(input.workspaceId);
      } else {
        const effectiveAgentId =
          input.scopeType === "task" && input.assigneeAgentId
            ? input.assigneeAgentId
            : input.agentId;

        if (!effectiveAgentId) {
          throw new Error("agentId is required for agent channel messages");
        }

        channel = await channelService.ensureAgentDmChannel(input.workspaceId, effectiveAgentId);
      }
    }

    if (!channel) {
      throw new Error("Channel not found");
    }

    return channel;
  }

  async function resolveResponsePlan(input: ResolveChannelRoutingInput): Promise<ChannelResponsePlan> {
    const channel = await resolveChannel(input);
    const { channelMembers, participantMembers } = await selectParticipantMembers(
      channel,
      input.content,
      input.mentions,
    );
    const participantIds = [...new Set(participantMembers.map((member) => member.actorId))];

    if (participantIds.length === 0) {
      throw new Error("No agent members available in this channel");
    }

    return {
      channel,
      channelMembers,
      participantMembers,
    };
  }

  return {
    resolveChannel,
    resolveResponsePlan,
  };
}
