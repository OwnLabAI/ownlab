ALTER TABLE "teams" DROP CONSTRAINT "teams_workspace_id_fkey";
--> statement-breakpoint
ALTER TABLE "teams"
  ALTER COLUMN "workspace_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "teams"
  ADD CONSTRAINT "teams_workspace_id_fkey"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE set null
  ON UPDATE no action;
