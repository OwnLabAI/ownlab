ALTER TABLE "agent_conversation_sessions"
RENAME COLUMN "codex_session_id" TO "runtime_session_id";
--> statement-breakpoint
ALTER TABLE "agent_conversation_sessions"
RENAME COLUMN "codex_session_params" TO "runtime_session_params";
--> statement-breakpoint
ALTER TABLE "agent_conversation_sessions"
RENAME COLUMN "codex_session_display_id" TO "runtime_session_display_id";
--> statement-breakpoint
ALTER TABLE "agent_conversation_sessions"
ADD COLUMN "transcript_path" text;
--> statement-breakpoint
ALTER TABLE "agent_conversation_sessions"
ADD COLUMN "transcript_status" text DEFAULT 'pending' NOT NULL;
