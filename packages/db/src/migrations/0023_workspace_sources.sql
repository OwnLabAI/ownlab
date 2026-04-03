CREATE TABLE "workspace_sources" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "kind" text DEFAULT 'native' NOT NULL,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "status" text DEFAULT 'ready' NOT NULL,
  "summary" text,
  "file_path" text,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "connector_type" text,
  "connector_ref_id" text,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "workspace_sources"
  ADD CONSTRAINT "workspace_sources_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "workspace_sources_workspace_idx" ON "workspace_sources" USING btree ("workspace_id");
--> statement-breakpoint
CREATE INDEX "workspace_sources_workspace_updated_idx" ON "workspace_sources" USING btree ("workspace_id","updated_at");
