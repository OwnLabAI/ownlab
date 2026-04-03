ALTER TABLE "workspace_sources"
  ADD COLUMN IF NOT EXISTS "file_path" text;
--> statement-breakpoint
ALTER TABLE "workspace_sources"
  ADD COLUMN IF NOT EXISTS "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "workspace_sources"
  ADD COLUMN IF NOT EXISTS "connector_type" text;
--> statement-breakpoint
ALTER TABLE "workspace_sources"
  ADD COLUMN IF NOT EXISTS "connector_ref_id" text;
--> statement-breakpoint
ALTER TABLE "workspace_sources"
  ADD COLUMN IF NOT EXISTS "last_synced_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_sources_workspace_idx" ON "workspace_sources" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workspace_sources_workspace_updated_idx" ON "workspace_sources" USING btree ("workspace_id","updated_at");
