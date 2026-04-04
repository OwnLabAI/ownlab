'use client';

import { useEffect, useState, useTransition } from 'react';
import { BookImage, BookOpenText, ExternalLink, FileVideo, Globe, ImageIcon, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { MarkdownBody } from '@/components/markdown';
import { Button } from '@/components/ui/button';
import { buildOwnlabApiUrl, deleteWorkspaceSource, fetchWorkspaceSource, type WorkspaceSourceRecord } from '@/lib/api';
import { cn } from '@/lib/utils';
import { dispatchWorkspaceSourcesChanged } from '../tool-panel/sources-panel';

function formatTime(value: string | null) {
  if (!value) return 'Not available';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not available';
  return parsed.toLocaleString();
}

export function WorkspaceSourceView({
  workspaceId,
  sourceId,
  onDeleted,
}: {
  workspaceId: string;
  sourceId: string;
  onDeleted: () => void;
}) {
  return (
    <WorkspaceNativeSourceView
      workspaceId={workspaceId}
      sourceId={sourceId}
      onDeleted={onDeleted}
    />
  );
}

function WorkspaceNativeSourceView({
  workspaceId,
  sourceId,
  onDeleted,
}: {
  workspaceId: string;
  sourceId: string;
  onDeleted: () => void;
}) {
  const [source, setSource] = useState<WorkspaceSourceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();

  async function loadSource() {
    setLoading(true);
    setError(null);
    try {
      const nextSource = await fetchWorkspaceSource(workspaceId, sourceId);
      setSource(nextSource);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to load source');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSource();
  }, [workspaceId, sourceId]);

  function handleDelete() {
    startTransition(async () => {
      try {
        await deleteWorkspaceSource(workspaceId, sourceId);
        dispatchWorkspaceSourcesChanged(workspaceId);
        onDeleted();
        toast.success('Source removed.');
      } catch (nextError) {
        toast.error(nextError instanceof Error ? nextError.message : 'Failed to remove source');
      }
    });
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading source…</p>
      </div>
    );
  }

  if (error || !source) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-destructive">{error ?? 'Failed to load source'}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadSource()}>
          Retry
        </Button>
      </div>
    );
  }

  const url = typeof source.metadata?.url === 'string' ? source.metadata.url : null;
  const siteName =
    typeof source.metadata?.siteName === 'string' && source.metadata.siteName.trim()
      ? source.metadata.siteName.trim()
      : null;
  const byline =
    typeof source.metadata?.byline === 'string' && source.metadata.byline.trim()
      ? source.metadata.byline.trim()
      : null;
  const description =
    typeof source.metadata?.description === 'string' && source.metadata.description.trim()
      ? source.metadata.description.trim()
      : source.summary?.trim() || null;
  const assetPath = typeof source.metadata?.assetPath === 'string' ? source.metadata.assetPath : null;
  const assetUrl =
    assetPath
      ? buildOwnlabApiUrl(`/api/workspace/${encodeURIComponent(workspaceId)}/files/content?path=${encodeURIComponent(assetPath)}`)
      : null;

  if (source.type === 'webpage') {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#171717] text-white">
        <div className="flex items-center justify-end border-b border-white/8 px-6 py-5">
          <div className="flex items-center gap-2">
            {url ? (
              <Button asChild type="button" variant="ghost" size="sm" className="rounded-full text-white/70 hover:bg-white/8 hover:text-white">
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" />
                  Open
                </a>
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full border-white/14 bg-transparent text-white hover:bg-white/8 hover:text-white"
              disabled={pending}
              onClick={() => void handleDelete()}
            >
              <Trash2 className="size-4" />
              Remove
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <article className="mx-auto flex w-full max-w-[920px] flex-col px-8 py-14 sm:px-12 sm:py-18">
            <header className="mx-auto w-full max-w-[780px]">
              <div className="mb-7 flex items-center gap-3 text-white/70">
                <div className="flex size-11 items-center justify-center rounded-full border border-white/10 bg-white text-black">
                  <Globe className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-base font-medium text-white/78">{siteName ?? 'Webpage'}</div>
                  <div className="mt-0.5 text-sm text-white/42">
                    {byline ?? `Saved ${formatTime(source.updatedAt)}`}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <h1 className="flex-1 text-balance text-[2.3rem] leading-[1.08] font-semibold tracking-[-0.04em] text-white sm:text-[3.1rem]">
                  {source.title}
                </h1>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/60 transition hover:border-white/18 hover:text-white"
                    aria-label="Open original webpage"
                  >
                    <ExternalLink className="size-4" />
                  </a>
                ) : null}
              </div>

              {description ? (
                <p className="mt-8 max-w-[46rem] text-lg leading-8 text-white/62 italic">
                  {description}
                </p>
              ) : null}
            </header>

            <div className="mx-auto mt-12 w-full max-w-[780px]">
              {source.content?.trim() ? (
                <MarkdownBody
                  markdown={source.content}
                  className={cn(
                    'ownlab-source-article text-[1.08rem] leading-[1.9] text-white/92',
                    '[&_a]:text-white [&_a]:underline [&_a]:underline-offset-4',
                    '[&_img]:my-10 [&_img]:w-full [&_img]:rounded-[1.75rem]',
                    '[&_p]:text-white/92',
                    '[&_strong]:font-semibold [&_strong]:text-white',
                    '[&_em]:text-white/88',
                    '[&_blockquote]:border-white/12 [&_blockquote]:text-white/72',
                    '[&_pre]:border [&_pre]:border-white/10 [&_pre]:bg-black/30 [&_pre]:text-white/88',
                    '[&_code]:bg-white/8 [&_code]:text-white',
                  )}
                />
              ) : (
                <div className="rounded-[2rem] border border-white/10 bg-white/3 px-6 py-8 text-base leading-8 text-white/55">
                  This webpage was saved, but no readable article body is available yet.
                </div>
              )}
            </div>
          </article>
        </div>
      </div>
    );
  }

  const sourceLabel =
    source.type === 'video'
      ? 'YouTube Video'
      : source.type === 'image'
        ? 'Image'
        : 'Source';
  const openLabel = source.type === 'video' ? 'Open Video' : source.type === 'image' ? 'Open Image' : 'Open Source';
  const SourceIcon =
    source.type === 'video'
      ? FileVideo
      : source.type === 'image'
        ? BookImage
        : BookOpenText;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-border/60 px-5 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-full border border-border/70 bg-muted/30">
            <SourceIcon className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">{source.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{description ?? sourceLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {url ? (
            <Button asChild type="button" variant="ghost" size="sm" className="rounded-full">
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                {openLabel}
              </a>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={pending}
            onClick={() => void handleDelete()}
          >
            <Trash2 className="size-4" />
            Remove
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-4xl flex-col gap-6">
          {source.type === 'image' && assetUrl ? (
            <div className="overflow-hidden rounded-[2rem] border border-border/60 bg-background/70">
              <img src={assetUrl} alt={source.title} className="max-h-[40rem] w-full object-contain" />
            </div>
          ) : null}

          {source.content?.trim() ? (
            <div className="rounded-[2rem] border border-border/60 bg-card/70 p-6 shadow-[0_10px_30px_rgba(15,23,42,0.05)] dark:shadow-[0_12px_30px_rgba(0,0,0,0.28)]">
              <MarkdownBody
                markdown={source.content}
                className={cn(
                  'max-w-none text-[1rem] leading-8 text-foreground',
                  '[&_h1]:mt-0 [&_h1]:text-3xl [&_h1]:font-semibold',
                  '[&_h2]:mt-10 [&_h2]:text-2xl [&_h2]:font-semibold',
                  '[&_h3]:mt-8 [&_h3]:text-xl [&_h3]:font-semibold',
                  '[&_p]:my-4 [&_p]:break-words',
                  '[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6',
                  '[&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6',
                  '[&_li]:my-1',
                  '[&_img]:my-6 [&_img]:w-full [&_img]:rounded-2xl',
                  '[&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-background [&_pre]:p-4 [&_pre]:text-sm [&_pre]:leading-7',
                  '[&_code]:break-words [&_code]:rounded [&_code]:bg-background/80 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[0.9em]',
                  '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
                )}
              />
            </div>
          ) : null}

          {source.type === 'image' && assetUrl ? (
            <div>
              <Button asChild type="button" variant="outline" className="rounded-full">
                <a href={assetUrl} target="_blank" rel="noreferrer">
                  <ImageIcon className="size-4" />
                  Open Image File
                </a>
              </Button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
