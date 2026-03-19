ALTER TABLE "tasks" ADD COLUMN "type" text DEFAULT 'loop' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "objective" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "program_markdown" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "schedule_enabled" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "schedule_type" text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "interval_sec" integer;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "last_run_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "next_run_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "last_result_summary" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "best_metric_label" text;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "best_metric_value" double precision;
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "metadata" jsonb;
--> statement-breakpoint
CREATE TABLE "task_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"trigger" text DEFAULT 'manual' NOT NULL,
	"run_kind" text DEFAULT 'task' NOT NULL,
	"decision" text,
	"summary" text,
	"error" text,
	"metrics_json" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_runs"
ADD CONSTRAINT "task_runs_task_id_tasks_id_fk"
FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "task_run_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_run_events"
ADD CONSTRAINT "task_run_events_run_id_task_runs_id_fk"
FOREIGN KEY ("run_id") REFERENCES "public"."task_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "task_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"run_id" uuid,
	"key" text NOT NULL,
	"value" double precision NOT NULL,
	"unit" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_metrics"
ADD CONSTRAINT "task_metrics_task_id_tasks_id_fk"
FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_metrics"
ADD CONSTRAINT "task_metrics_run_id_task_runs_id_fk"
FOREIGN KEY ("run_id") REFERENCES "public"."task_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "task_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"run_id" uuid,
	"kind" text NOT NULL,
	"label" text NOT NULL,
	"content" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task_artifacts"
ADD CONSTRAINT "task_artifacts_task_id_tasks_id_fk"
FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_artifacts"
ADD CONSTRAINT "task_artifacts_run_id_task_runs_id_fk"
FOREIGN KEY ("run_id") REFERENCES "public"."task_runs"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "task_runs_task_idx" ON "task_runs" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX "task_runs_status_idx" ON "task_runs" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "task_run_events_run_idx" ON "task_run_events" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "task_metrics_task_idx" ON "task_metrics" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX "task_metrics_run_idx" ON "task_metrics" USING btree ("run_id");
--> statement-breakpoint
CREATE INDEX "task_artifacts_task_idx" ON "task_artifacts" USING btree ("task_id");
--> statement-breakpoint
CREATE INDEX "task_artifacts_run_idx" ON "task_artifacts" USING btree ("run_id");
