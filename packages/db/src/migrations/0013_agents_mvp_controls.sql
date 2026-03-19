CREATE TABLE "channel_agent_skill_preferences" (
  "channel_id" uuid NOT NULL,
  "agent_id" uuid NOT NULL,
  "mode" text DEFAULT 'inherit' NOT NULL,
  "selected_skill_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "channel_agent_skill_preferences_channel_id_agent_id_pk" PRIMARY KEY("channel_id","agent_id")
);
--> statement-breakpoint
ALTER TABLE "channel_agent_skill_preferences"
ADD CONSTRAINT "channel_agent_skill_preferences_channel_id_channels_id_fk"
FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "channel_agent_skill_preferences"
ADD CONSTRAINT "channel_agent_skill_preferences_agent_id_agents_id_fk"
FOREIGN KEY ("agent_id") REFERENCES "public"."agents"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "channel_agent_skill_preferences_agent_idx"
ON "channel_agent_skill_preferences" USING btree ("agent_id","updated_at");
