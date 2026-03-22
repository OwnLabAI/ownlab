ALTER TABLE "workspaces"
ADD COLUMN "goal_markdown" text;
--> statement-breakpoint
ALTER TABLE "workspaces"
ADD COLUMN "goal_updated_at" timestamp with time zone;
