CREATE TABLE "agent_conversation_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "agent_id" uuid NOT NULL,
  "channel_id" uuid NOT NULL,
  "title" text,
  "codex_session_id" text,
  "codex_session_params" jsonb,
  "codex_session_display_id" text,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "last_message_at" timestamp with time zone,
  "archived_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agent_conversation_sessions"
ADD CONSTRAINT "agent_conversation_sessions_agent_id_agents_id_fk"
FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "agent_conversation_sessions"
ADD CONSTRAINT "agent_conversation_sessions_channel_id_channels_id_fk"
FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "agent_conversation_sessions_agent_channel_idx"
ON "agent_conversation_sessions" USING btree ("agent_id","channel_id","created_at");
--> statement-breakpoint
ALTER TABLE "channel_messages" ADD COLUMN "session_id" uuid;
--> statement-breakpoint
ALTER TABLE "channel_messages"
ADD CONSTRAINT "channel_messages_session_id_agent_conversation_sessions_id_fk"
FOREIGN KEY ("session_id") REFERENCES "public"."agent_conversation_sessions"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "channel_messages_session_created_idx"
ON "channel_messages" USING btree ("session_id","created_at");
