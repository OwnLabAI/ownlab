'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { BookOpenText, ExternalLink, LibraryBig, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  fetchWorkspacePluginView,
  triggerWorkspacePluginAction,
  type WorkspacePluginItem,
  type WorkspacePluginViewRecord,
} from '@/lib/api';
import { cn } from '@/lib/utils';
import { dispatchWorkspacePluginContextChanged } from '../tool-panel-plugins';

export const WORKSPACE_PLUGIN_INSERT_DRAFT_EVENT = 'workspace-plugin-insert-draft';

function formatConnectionLabel(value: unknown) {
  return value === 'connected' ? 'Connected' : 'Needs config';
}

function dispatchInsertDraft(workspaceId: string, text: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(WORKSPACE_PLUGIN_INSERT_DRAFT_EVENT, {
      detail: { workspaceId, text },
    }),
  );
}

export function WorkspacePluginView({
  workspaceId,
  pluginId,
}: {
  workspaceId: string;
  pluginId: string;
}) {
  const [view, setView] = useState<WorkspacePluginViewRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, startTransition] = useTransition();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  async function loadView() {
    setLoading(true);
    setError(null);
    try {
      const nextView = await fetchWorkspacePluginView(workspaceId, pluginId);
      setView(nextView);
      const items = Array.isArray(nextView.data.items) ? nextView.data.items : [];
      setSelectedItemId((current) => current ?? items[0]?.id ?? null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load plugin view');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadView();
  }, [workspaceId, pluginId]);

  const items = useMemo(
    () => (Array.isArray(view?.data.items) ? view?.data.items : []),
    [view],
  );
  const contextItemIds = useMemo(
    () => new Set(Array.isArray(view?.data.contextItemIds) ? view?.data.contextItemIds : []),
    [view],
  );
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? items[0] ?? null;

  async function handleSync() {
    startTransition(async () => {
      try {
        await triggerWorkspacePluginAction(workspaceId, pluginId, 'sync');
        dispatchWorkspacePluginContextChanged(workspaceId);
        await loadView();
        toast.success('Zotero sync completed.');
      } catch (nextError) {
        const message = nextError instanceof Error ? nextError.message : 'Failed to sync plugin';
        setError(message);
        toast.error(message);
      }
    });
  }

  async function handleToggleContext(item: WorkspacePluginItem, enabled: boolean) {
    startTransition(async () => {
      try {
        await triggerWorkspacePluginAction(
          workspaceId,
          pluginId,
          enabled ? 'remove_from_context' : 'add_to_context',
          { itemId: item.id },
        );
        dispatchWorkspacePluginContextChanged(workspaceId);
        await loadView();
        toast.success(
          enabled
            ? 'Removed source from workspace context.'
            : 'Added source to workspace context.',
        );
      } catch (nextError) {
        toast.error(nextError instanceof Error ? nextError.message : 'Failed to update workspace context');
      }
    });
  }

  function handleInsertReference(item: WorkspacePluginItem) {
    const text = item.citationText?.trim() || item.title;
    dispatchInsertDraft(workspaceId, text);
    toast.success('Reference inserted into the workspace draft.');
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading plugin view…</p>
      </div>
    );
  }

  if (error || !view) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-destructive">{error ?? 'Failed to load plugin view'}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadView()}>
          Retry
        </Button>
      </div>
    );
  }

  const syncedCount =
    typeof view.data.syncedItemCount === 'number' ? Number(view.data.syncedItemCount) : items.length;
  const contextCount = contextItemIds.size;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-border/60 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <LibraryBig className="size-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">{view.plugin.plugin.displayName}</h2>
              <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">
                {formatConnectionLabel(view.data.connectionHealth)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Browse sources in the viewboard while keeping channel context on the right.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={pendingAction}
            onClick={() => void handleSync()}
          >
            <RefreshCcw className="mr-1 size-4" />
            Sync
          </Button>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span>{syncedCount} items</span>
          <span>{contextCount} in workspace context</span>
          <span>Status {String(view.data.lastSyncStatus ?? 'idle')}</span>
          <span>{view.plugin.lastSyncedAt ? new Date(view.plugin.lastSyncedAt).toLocaleString() : 'Not synced yet'}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="max-w-md rounded-3xl border border-dashed border-border/70 bg-card/40 px-8 py-10 text-center">
            <BookOpenText className="mx-auto size-8 text-muted-foreground" />
            <h3 className="mt-4 text-base font-semibold text-foreground">No Zotero items yet</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Save a valid Zotero configuration in the Plugins panel, then run a sync to populate this view.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[320px_minmax(0,1fr)]">
          <div className="min-h-0 overflow-y-auto border-r border-border/60 p-3">
            <div className="space-y-2">
              {items.map((item) => {
                const inContext = contextItemIds.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className={cn(
                      'w-full rounded-2xl border px-3 py-3 text-left transition-colors',
                      selectedItem?.id === item.id
                        ? 'border-foreground/10 bg-background shadow-sm'
                        : 'border-transparent bg-card/70 hover:border-border hover:bg-accent/45',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">{item.title}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {(item.creators ?? []).join(', ') || 'Unknown author'}
                          {item.year ? ` · ${item.year}` : ''}
                        </p>
                      </div>
                      {inContext ? (
                        <span className="rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">
                          Context
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">{item.publication ?? 'Untitled source'}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="min-h-0 overflow-y-auto p-5">
            {selectedItem ? (
              <div className="mx-auto flex max-w-3xl flex-col">
                <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:shadow-[0_12px_30px_rgba(0,0,0,0.28)]">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-xl font-semibold text-foreground">{selectedItem.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {(selectedItem.creators ?? []).join(', ') || 'Unknown author'}
                        {selectedItem.year ? ` · ${selectedItem.year}` : ''}
                      </p>
                    </div>
                    <div className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      {selectedItem.publication ?? 'Source'}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">Notes</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{selectedItem.noteCount ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">Attachments</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{selectedItem.attachmentCount ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3">
                      <p className="text-xs text-muted-foreground">Tags</p>
                      <p className="mt-1 text-sm font-medium text-foreground">{(selectedItem.tags ?? []).length}</p>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h4 className="text-sm font-semibold text-foreground">Abstract</h4>
                    <p className="mt-2 text-sm leading-7 text-muted-foreground">
                      {selectedItem.abstract?.trim() ? selectedItem.abstract : 'No abstract available yet.'}
                    </p>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {(selectedItem.tags ?? []).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="mt-8 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      className="rounded-full"
                      disabled={pendingAction}
                      onClick={() => void handleToggleContext(selectedItem, contextItemIds.has(selectedItem.id))}
                    >
                      {contextItemIds.has(selectedItem.id) ? 'Remove from Workspace Context' : 'Add to Workspace Context'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => handleInsertReference(selectedItem)}
                    >
                      Insert into Draft
                    </Button>
                    {selectedItem.zoteroUrl ? (
                      <Button asChild type="button" variant="outline" className="rounded-full">
                        <a href={selectedItem.zoteroUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-1 size-4" />
                          Open Source
                        </a>
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
