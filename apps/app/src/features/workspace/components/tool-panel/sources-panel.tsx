'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { BookImage, FileVideo, Globe, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  createWorkspaceSource,
  fetchWorkspaceSources,
  type WorkspaceSourceRecord,
} from '@/lib/api';
import { cn } from '@/lib/utils';

const WORKSPACE_SOURCES_CHANGED_EVENT = 'workspace-sources-changed';

type SourceDialogType = 'webpage' | 'image' | 'video' | null;

function formatTime(value: string | null) {
  if (!value) return 'Not synced yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not synced yet';
  return parsed.toLocaleString();
}

function getTypeLabel(type: WorkspaceSourceRecord['type']) {
  switch (type) {
    case 'webpage':
      return 'Webpage';
    case 'image':
      return 'Image';
    case 'video':
      return 'Video';
    default:
      return 'Source';
  }
}

function getStatusLabel(status: string) {
  if (status === 'completed') return 'Ready';
  return status;
}

export function dispatchWorkspaceSourcesChanged(workspaceId: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(WORKSPACE_SOURCES_CHANGED_EVENT, { detail: { workspaceId } }));
}

export function SourcesPanel({
  workspaceId,
  selectedSourceId,
  onSourceSelect,
}: {
  workspaceId: string;
  selectedSourceId: string | null;
  onSourceSelect: (sourceId: string | null) => void;
}) {
  const [sources, setSources] = useState<WorkspaceSourceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogType, setDialogType] = useState<SourceDialogType>(null);
  const [pending, startTransition] = useTransition();
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  const loadSources = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const nextSources = await fetchWorkspaceSources(workspaceId);
      setSources(nextSources);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load sources');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void loadSources();
  }, [loadSources]);

  useEffect(() => {
    function handleSourcesChanged(event: Event) {
      const detail = (event as CustomEvent<{ workspaceId?: string }>).detail;
      if (detail?.workspaceId !== workspaceId) return;
      void loadSources();
    }

    window.addEventListener(WORKSPACE_SOURCES_CHANGED_EVENT, handleSourcesChanged);
    return () => {
      window.removeEventListener(WORKSPACE_SOURCES_CHANGED_EVENT, handleSourcesChanged);
    };
  }, [loadSources, workspaceId]);

  const sourceItems = sources.map((source) => ({
    id: source.id,
    title: source.title,
    subtitle:
      source.summary ??
      source.filePath ??
      (typeof source.metadata?.url === 'string' ? source.metadata.url : '') ??
      '',
    type: source.type,
    status: source.status,
    updatedAt: source.updatedAt,
  }));

  useEffect(() => {
    if (selectedSourceId) {
      const exists = sourceItems.some((item) => item.id === selectedSourceId);
      if (!exists) {
        onSourceSelect(null);
      }
      return;
    }

    if (sourceItems[0]) {
      onSourceSelect(sourceItems[0].id);
    }
  }, [onSourceSelect, selectedSourceId, sourceItems]);

  function resetDialog() {
    setDialogType(null);
    setContent('');
    setImageFile(null);
  }

  function openDialog(nextType: SourceDialogType) {
    setContent('');
    setImageFile(null);
    setDialogType(nextType);
  }

  async function fileToDataUrl(file: File) {
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  function handleCreateNative(type: 'webpage' | 'image' | 'video') {
    startTransition(async () => {
      try {
        let metadata: Record<string, unknown> = {};

        if (type === 'webpage' || type === 'video') {
          metadata = { url: content.trim() };
        } else if (type === 'image') {
          if (!imageFile) {
            throw new Error('Image file is required');
          }
          metadata = {
            fileName: imageFile.name,
            mimeType: imageFile.type,
            dataUrl: await fileToDataUrl(imageFile),
          };
        }

        const created = await createWorkspaceSource(workspaceId, {
          type,
          content,
          metadata,
        });
        dispatchWorkspaceSourcesChanged(workspaceId);
        onSourceSelect(created.id);
        resetDialog();
        toast.success('Source added.');
      } catch (nextError) {
        toast.error(nextError instanceof Error ? nextError.message : 'Failed to add source');
      }
    });
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading sources…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadSources()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <div className="border-b border-border/60 px-3 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Sources</h3>
              <p className="text-xs text-muted-foreground">
                Materials saved directly into this workspace.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" className="rounded-full" onClick={() => openDialog('webpage')}>
                <Plus className="mr-1 size-4" />
                Add
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => openDialog('webpage')}>
              Webpage
            </Button>
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => openDialog('image')}>
              Image
            </Button>
            <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => openDialog('video')}>
              Video
            </Button>
          </div>
        </div>

        {sourceItems.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="mb-4 rounded-2xl border border-border/50 bg-card/80 p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
              <Globe className="size-7 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground">No sources yet</h3>
            <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
              Add webpages, images, or YouTube videos to save them directly under this workspace&apos;s sources folder.
            </p>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2 pt-3">
            <div className="space-y-2">
              {sourceItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSourceSelect(item.id)}
                  className={cn(
                    'w-full rounded-2xl border px-3 py-3 text-left transition-colors',
                    selectedSourceId === item.id
                      ? 'border-foreground/10 bg-background shadow-sm'
                      : 'border-transparent bg-card/70 hover:border-border hover:bg-accent/45',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {item.type === 'webpage' ? (
                          <Globe className="size-4 shrink-0 text-muted-foreground" />
                        ) : item.type === 'video' ? (
                          <FileVideo className="size-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <BookImage className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate text-sm font-medium text-foreground">{item.title}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{getTypeLabel(item.type)}</span>
                        <span>{getStatusLabel(item.status)}</span>
                        <span>{formatTime(item.updatedAt)}</span>
                      </div>
                      {item.subtitle ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {item.subtitle}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogType !== null} onOpenChange={(open) => !open && resetDialog()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Source</DialogTitle>
            <DialogDescription>
              Save sources directly into this workspace under sources/.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-foreground">Type</span>
              <div className="flex flex-wrap gap-2">
                {(['webpage', 'image', 'video'] as const).map((type) => (
                  <Button
                    key={type}
                    type="button"
                    variant={dialogType === type ? 'default' : 'outline'}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setDialogType(type)}
                  >
                    {getTypeLabel(type)}
                  </Button>
                ))}
              </div>
            </label>
            {dialogType === 'image' ? (
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-foreground">Image File</span>
                <Input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                />
              </label>
            ) : (
              <label className="grid gap-1.5">
                <span className="text-xs font-medium text-foreground">
                  {dialogType === 'webpage' ? 'Webpage URL' : 'YouTube URL'}
                </span>
                <Input
                  value={content}
                  onChange={(event) => setContent(event.target.value)}
                  placeholder={
                    dialogType === 'webpage'
                      ? 'https://example.com/article'
                      : 'https://www.youtube.com/watch?v=...'
                  }
                />
              </label>
            )}
          </div>

          <DialogFooter showCloseButton>
            <Button
              type="button"
              className="rounded-full"
              disabled={
                pending ||
                !dialogType ||
                (dialogType === 'image' ? !imageFile : !content.trim())
              }
              onClick={() => void handleCreateNative(dialogType as 'webpage' | 'image' | 'video')}
            >
              <Plus className="mr-1 size-4" />
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
