ALTER TABLE "task_boards" RENAME TO "taskboards";--> statement-breakpoint
ALTER INDEX "task_boards_lab_idx" RENAME TO "taskboards_lab_idx";--> statement-breakpoint
ALTER TABLE "taskboards" RENAME CONSTRAINT "task_boards_lab_id_labs_id_fk" TO "taskboards_lab_id_labs_id_fk";--> statement-breakpoint
ALTER TABLE "tasks" RENAME CONSTRAINT "tasks_board_id_task_boards_id_fk" TO "tasks_board_id_taskboards_id_fk";
