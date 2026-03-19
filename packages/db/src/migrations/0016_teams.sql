CREATE TABLE "teams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "lab_id" uuid NOT NULL REFERENCES "labs"("id"),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id"),
  "name" text NOT NULL,
  "description" text,
  "icon" text,
  "status" text DEFAULT 'active' NOT NULL,
  "leader_agent_id" uuid REFERENCES "agents"("id"),
  "runtime_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "team_members" (
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE cascade,
  "agent_id" uuid NOT NULL REFERENCES "agents"("id") ON DELETE cascade,
  "role" text DEFAULT 'worker' NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("team_id", "agent_id")
);

CREATE INDEX "teams_lab_idx" ON "teams" ("lab_id");
CREATE INDEX "teams_workspace_idx" ON "teams" ("workspace_id");
CREATE UNIQUE INDEX "teams_lab_name_idx" ON "teams" ("lab_id", "name");
CREATE INDEX "team_members_agent_idx" ON "team_members" ("agent_id");
