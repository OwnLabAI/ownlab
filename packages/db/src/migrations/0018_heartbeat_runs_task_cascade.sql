ALTER TABLE "heartbeat_runs" DROP CONSTRAINT "heartbeat_runs_task_id_tasks_id_fk";
--> statement-breakpoint
ALTER TABLE "heartbeat_runs"
ADD CONSTRAINT "heartbeat_runs_task_id_tasks_id_fk"
FOREIGN KEY ("task_id") REFERENCES "public"."tasks"("id") ON DELETE cascade ON UPDATE no action;
