ALTER TABLE "channels" ADD COLUMN "title" text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "last_message_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "last_message_preview" text;--> statement-breakpoint
ALTER TABLE "channels" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "channel_members" ADD COLUMN "runtime_state" jsonb;--> statement-breakpoint
ALTER TABLE "channel_members" ADD COLUMN "runtime_updated_at" timestamp with time zone;
