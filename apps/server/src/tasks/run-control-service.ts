import { stopRunningProcess } from "@ownlab/adapter-utils/server-utils";

const taskRuns = new Map<string, Set<string>>();

export function registerTaskRun(taskId: string, runId: string) {
  const runs = taskRuns.get(taskId) ?? new Set<string>();
  runs.add(runId);
  taskRuns.set(taskId, runs);
}

export function unregisterTaskRun(taskId: string, runId: string) {
  const runs = taskRuns.get(taskId);
  if (!runs) {
    return;
  }

  runs.delete(runId);
  if (runs.size === 0) {
    taskRuns.delete(taskId);
  }
}

export function stopTaskRuns(taskId: string) {
  const runs = [...(taskRuns.get(taskId) ?? [])];
  const stoppedRunIds = runs.filter((runId) => stopRunningProcess(runId));

  return {
    taskId,
    stopped: stoppedRunIds.length > 0,
    runIds: stoppedRunIds,
  };
}
