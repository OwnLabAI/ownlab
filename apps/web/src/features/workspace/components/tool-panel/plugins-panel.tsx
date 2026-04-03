'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { LibraryBig, PlugZap, RefreshCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  fetchWorkspacePlugins,
  fetchWorkspacePluginView,
  triggerWorkspacePluginAction,
  updateWorkspacePlugin,
  type WorkspacePluginRecord,
} from '@/lib/api';
import { cn } from '@/lib/utils';

export const WORKSPACE_PLUGIN_CONTEXT_CHANGED_EVENT = 'workspace-plugin-context-changed';

export function dispatchWorkspacePluginContextChanged(workspaceId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WORKSPACE_PLUGIN_CONTEXT_CHANGED_EVENT, { detail: { workspaceId } }));
}

function formatSyncTime(value: string | null) {
  if (!value) return 'Not synced yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not synced yet';
  return parsed.toLocaleString();
}

function getConnectionLabel(plugin: WorkspacePluginRecord) {
  if (!plugin.enabled) return 'Disabled';
  if (plugin.status === 'connected') return 'Connected';
  return 'Needs config';
}

export function PluginsPanel({
  workspaceId,
  selectedPluginId,
  onPluginSelect,
}: {
  workspaceId: string;
  selectedPluginId: string | null;
  onPluginSelect: (pluginId: string | null) => void;
}) {
  const [plugins, setPlugins] = useState<WorkspacePluginRecord[]>([]);
  const [draftConfig, setDraftConfig] = useState<Record<string, Record<string, string>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, startTransition] = useTransition();

  async function loadPlugins() {
    setIsLoading(true);
    setError(null);
    try {
      const nextPlugins = await fetchWorkspacePlugins(workspaceId);
      setPlugins(nextPlugins);
      setDraftConfig((current) => {
        const next = { ...current };
        for (const plugin of nextPlugins) {
          const config: Record<string, string> = {};
          for (const field of plugin.plugin.manifest.configFields) {
            config[field.key] =
              typeof plugin.config?.[field.key] === 'string' ? String(plugin.config[field.key]) : '';
          }
          next[plugin.pluginId] = config;
        }
        return next;
      });
      if (!selectedPluginId && nextPlugins[0]) {
        onPluginSelect(nextPlugins[0].pluginId);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load plugins');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadPlugins();
  }, [workspaceId]);

  const selectedPlugin = useMemo(
    () => plugins.find((plugin) => plugin.pluginId === selectedPluginId) ?? plugins[0] ?? null,
    [plugins, selectedPluginId],
  );

  async function handleSave(plugin: WorkspacePluginRecord) {
    const config = draftConfig[plugin.pluginId] ?? {};
    startTransition(async () => {
      try {
        const updated = await updateWorkspacePlugin(workspaceId, plugin.pluginId, {
          enabled: plugin.enabled,
          config,
        });
        setPlugins((current) =>
          current.map((entry) => (entry.pluginId === updated.pluginId ? updated : entry)),
        );
        toast.success(`${plugin.plugin.displayName} configuration saved.`);
      } catch (nextError) {
        toast.error(nextError instanceof Error ? nextError.message : 'Failed to save plugin');
      }
    });
  }

  async function handleSync(plugin: WorkspacePluginRecord) {
    startTransition(async () => {
      try {
        await triggerWorkspacePluginAction(workspaceId, plugin.pluginId, 'sync');
        const [nextPlugins, nextView] = await Promise.all([
          fetchWorkspacePlugins(workspaceId),
          fetchWorkspacePluginView(workspaceId, plugin.pluginId),
        ]);
        setPlugins(nextPlugins);
        onPluginSelect(nextView.plugin.pluginId);
        dispatchWorkspacePluginContextChanged(workspaceId);
        toast.success(`${plugin.plugin.displayName} sync completed.`);
      } catch (nextError) {
        toast.error(nextError instanceof Error ? nextError.message : 'Failed to sync plugin');
      }
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading plugins…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadPlugins()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="border-b border-border/60 px-3 pb-3">
        <h3 className="text-sm font-semibold text-foreground">Plugins</h3>
        <p className="text-xs text-muted-foreground">
          Connect external tools without leaving this workspace.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-3">
        <div className="space-y-2">
          {plugins.map((plugin) => {
            const isSelected = selectedPlugin?.pluginId === plugin.pluginId;
            const config = draftConfig[plugin.pluginId] ?? {};

            return (
              <div
                key={plugin.id}
                className={cn(
                  'rounded-2xl border px-3 py-3 transition-colors',
                  isSelected
                    ? 'border-foreground/10 bg-background shadow-sm'
                    : 'border-transparent bg-card/70 hover:border-border',
                )}
              >
                <button
                  type="button"
                  onClick={() => onPluginSelect(plugin.pluginId)}
                  className="flex w-full items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <LibraryBig className="size-4 text-muted-foreground" />
                      <span className="truncate text-sm font-medium text-foreground">
                        {plugin.plugin.displayName}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {plugin.plugin.manifest.description}
                    </p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                    {getConnectionLabel(plugin)}
                  </span>
                </button>

                {isSelected ? (
                  <div className="mt-3 space-y-3 border-t border-border/60 pt-3">
                    <div className="grid gap-2">
                      {plugin.plugin.manifest.configFields.map((field) => (
                        <label key={field.key} className="grid gap-1.5">
                          <span className="text-xs font-medium text-foreground">{field.label}</span>
                          <Input
                            type={field.type === 'password' ? 'password' : 'text'}
                            value={config[field.key] ?? ''}
                            placeholder={field.placeholder}
                            onChange={(event) => {
                              const value = event.target.value;
                              setDraftConfig((current) => ({
                                ...current,
                                [plugin.pluginId]: {
                                  ...(current[plugin.pluginId] ?? {}),
                                  [field.key]: value,
                                },
                              }));
                            }}
                          />
                        </label>
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{plugin.plugin.version}</span>
                      <span>Last sync {formatSyncTime(plugin.lastSyncedAt)}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="rounded-full"
                        disabled={pendingAction}
                        onClick={() => void handleSave(plugin)}
                      >
                        <Save className="mr-1 size-4" />
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={pendingAction}
                        onClick={() => void handleSync(plugin)}
                      >
                        <RefreshCcw className="mr-1 size-4" />
                        Sync
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}

          {plugins.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 px-6 py-10 text-center">
              <PlugZap className="size-6 text-muted-foreground" />
              <h3 className="mt-3 text-sm font-medium text-foreground">No plugins yet</h3>
              <p className="mt-1 max-w-xs text-xs leading-5 text-muted-foreground">
                Official workspace plugins will appear here once the host registry is configured.
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
