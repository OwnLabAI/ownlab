CREATE TABLE "plugins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lab_id" uuid NOT NULL,
  "key" text NOT NULL,
  "display_name" text NOT NULL,
  "version" text DEFAULT '0.1.0' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "manifest" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_plugins" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "workspace_id" uuid NOT NULL,
  "plugin_id" uuid NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "status" text DEFAULT 'needs_config' NOT NULL,
  "config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "state" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_synced_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plugins"
  ADD CONSTRAINT "plugins_lab_id_labs_id_fk"
  FOREIGN KEY ("lab_id") REFERENCES "public"."labs"("id")
  ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workspace_plugins"
  ADD CONSTRAINT "workspace_plugins_workspace_id_workspaces_id_fk"
  FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "workspace_plugins"
  ADD CONSTRAINT "workspace_plugins_plugin_id_plugins_id_fk"
  FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id")
  ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "plugins_lab_idx" ON "plugins" USING btree ("lab_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "plugins_lab_key_idx" ON "plugins" USING btree ("lab_id","key");
--> statement-breakpoint
CREATE INDEX "workspace_plugins_workspace_idx" ON "workspace_plugins" USING btree ("workspace_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_plugins_workspace_plugin_idx" ON "workspace_plugins" USING btree ("workspace_id","plugin_id");
