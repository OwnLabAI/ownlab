CREATE TABLE "workspace_members" (
	"workspace_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"actor_type" text DEFAULT 'agent' NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"display_name" text,
	"icon" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_members_workspace_id_actor_id_pk" PRIMARY KEY("workspace_id","actor_id")
);
--> statement-breakpoint
ALTER TABLE "workspace_members"
ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk"
FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "workspace_members_actor_idx" ON "workspace_members" USING btree ("actor_id");
--> statement-breakpoint
CREATE INDEX "workspace_members_workspace_actor_type_idx" ON "workspace_members" USING btree ("workspace_id","actor_type");
