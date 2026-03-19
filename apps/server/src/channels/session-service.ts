import type { Db } from "@ownlab/db";
import {
  agentConversationSessions,
  and,
  asc,
  channelMessages,
  desc,
  eq,
  isNull,
} from "@ownlab/db";

export function createConversationSessionService(db: Db) {
  async function listSessions(channelId: string) {
    return db
      .select()
      .from(agentConversationSessions)
      .where(and(eq(agentConversationSessions.channelId, channelId), isNull(agentConversationSessions.archivedAt)))
      .orderBy(desc(agentConversationSessions.lastMessageAt), desc(agentConversationSessions.createdAt));
  }

  async function getSessionById(sessionId: string) {
    const rows = await db
      .select()
      .from(agentConversationSessions)
      .where(eq(agentConversationSessions.id, sessionId))
      .limit(1);
    return rows[0] ?? null;
  }

  async function createSession(input: {
    agentId: string;
    channelId: string;
    title?: string | null;
  }) {
    const [created] = await db
      .insert(agentConversationSessions)
      .values({
        agentId: input.agentId,
        channelId: input.channelId,
        title: input.title ?? null,
      })
      .returning();
    return created;
  }

  async function ensureSession(input: {
    agentId: string;
    channelId: string;
    sessionId?: string | null;
  }) {
    if (input.sessionId) {
      const existing = await getSessionById(input.sessionId);
      if (existing && existing.channelId === input.channelId && existing.agentId === input.agentId) {
        return existing;
      }
    }

    const existingSessions = await listSessions(input.channelId);
    const existing = existingSessions.find((session) => session.agentId === input.agentId);
    if (existing) {
      return existing;
    }

    return createSession({
      agentId: input.agentId,
      channelId: input.channelId,
      title: null,
    });
  }

  async function updateSessionAfterMessage(input: {
    sessionId: string;
    codexSessionId?: string | null;
    codexSessionParams?: Record<string, unknown> | null;
    codexSessionDisplayId?: string | null;
    titleHint?: string | null;
  }) {
    const current = await getSessionById(input.sessionId);
    if (!current) {
      return null;
    }

    const [updated] = await db
      .update(agentConversationSessions)
      .set({
        codexSessionId: input.codexSessionId === undefined ? current.codexSessionId : input.codexSessionId,
        codexSessionParams: input.codexSessionParams === undefined ? current.codexSessionParams : input.codexSessionParams,
        codexSessionDisplayId:
          input.codexSessionDisplayId === undefined
            ? current.codexSessionDisplayId
            : input.codexSessionDisplayId,
        title: current.title ?? input.titleHint ?? null,
        lastMessageAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentConversationSessions.id, input.sessionId))
      .returning();

    return updated ?? null;
  }

  async function deleteSession(sessionId: string) {
    await db.delete(channelMessages).where(eq(channelMessages.sessionId, sessionId));
    const rows = await db
      .delete(agentConversationSessions)
      .where(eq(agentConversationSessions.id, sessionId))
      .returning();
    return rows[0] ?? null;
  }

  async function listSessionMessages(channelId: string, sessionId: string, limit: number) {
    const safeLimit = Math.min(Math.max(limit, 1), 200);
    return db
      .select()
      .from(channelMessages)
      .where(and(eq(channelMessages.channelId, channelId), eq(channelMessages.sessionId, sessionId)))
      .orderBy(asc(channelMessages.createdAt))
      .limit(safeLimit);
  }

  return {
    listSessions,
    getSessionById,
    createSession,
    ensureSession,
    updateSessionAfterMessage,
    deleteSession,
    listSessionMessages,
  };
}
