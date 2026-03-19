import { clearInterruptedProcess, stopRunningProcess, wasProcessInterrupted } from "@ownlab/adapter-utils/server-utils";

const channelRuns = new Map<string, Set<string>>();

export function registerChannelRun(channelId: string, runId: string) {
  const runs = channelRuns.get(channelId) ?? new Set<string>();
  runs.add(runId);
  channelRuns.set(channelId, runs);
}

export function unregisterChannelRun(channelId: string, runId: string) {
  const runs = channelRuns.get(channelId);
  if (!runs) {
    return;
  }

  runs.delete(runId);
  if (runs.size === 0) {
    channelRuns.delete(channelId);
  }
}

export function stopChannelRuns(channelId: string) {
  const runs = [...(channelRuns.get(channelId) ?? [])];
  const stoppedRunIds = runs.filter((runId) => stopRunningProcess(runId));
  return {
    channelId,
    stopped: stoppedRunIds.length > 0,
    runIds: stoppedRunIds,
  };
}

export function isChannelRunInterrupted(runId: string) {
  return wasProcessInterrupted(runId);
}

export function clearChannelRunInterrupted(runId: string) {
  clearInterruptedProcess(runId);
}
