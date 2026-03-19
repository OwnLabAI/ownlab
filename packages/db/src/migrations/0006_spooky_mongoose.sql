CREATE TABLE "channel_members" (
	"channel_id" uuid NOT NULL,
	"actor_id" text NOT NULL,
	"actor_type" text DEFAULT 'agent' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channel_members_channel_id_actor_id_pk" PRIMARY KEY("channel_id","actor_id")
);
--> statement-breakpoint
ALTER TABLE "channel_members" ADD CONSTRAINT "channel_members_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channel_members_actor_idx" ON "channel_members" USING btree ("actor_id");