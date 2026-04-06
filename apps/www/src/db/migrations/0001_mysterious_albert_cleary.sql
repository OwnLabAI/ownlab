CREATE TABLE "waitlist_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"source" text DEFAULT 'website' NOT NULL,
	"locale" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "waitlist_entry_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "waitlist_entry_email_idx" ON "waitlist_entry" USING btree ("email");--> statement-breakpoint
CREATE INDEX "waitlist_entry_source_idx" ON "waitlist_entry" USING btree ("source");