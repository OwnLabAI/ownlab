DROP TABLE IF EXISTS "task_run_events" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "task_metrics" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "task_artifacts" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "task_runs" CASCADE;
--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "program_markdown";
--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "best_metric_label";
--> statement-breakpoint
ALTER TABLE "tasks" DROP COLUMN IF EXISTS "best_metric_value";
--> statement-breakpoint
ALTER TABLE "tasks" ALTER COLUMN "type" SET DEFAULT 'auto';
