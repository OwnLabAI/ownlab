'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { MarkdownEditor } from '@/components/markdown';
import { Button } from '@/components/ui/button';
import { fetchWorkspaceGoal, updateWorkspaceGoal } from '@/lib/api';

const DEFAULT_GOAL_MARKDOWN = '';

function formatGoalUpdatedAt(value: string | null) {
  if (!value) return 'Not saved yet';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Not saved yet';
  return parsed.toLocaleString();
}

export function ToolPanelGoal({ workspaceId }: { workspaceId: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [markdown, setMarkdown] = useState(DEFAULT_GOAL_MARKDOWN);
  const [savedMarkdown, setSavedMarkdown] = useState(DEFAULT_GOAL_MARKDOWN);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autosaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchWorkspaceGoal(workspaceId)
      .then((goal) => {
        if (cancelled) return;
        const nextMarkdown = goal.markdown?.trim() ? goal.markdown : DEFAULT_GOAL_MARKDOWN;
        setMarkdown(nextMarkdown);
        setSavedMarkdown(nextMarkdown);
        setUpdatedAt(goal.updatedAt);
      })
      .catch((nextError) => {
        console.error('Failed to fetch workspace goal:', nextError);
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : 'Failed to fetch workspace goal');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    return () => {
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
      }
    };
  }, []);

  const hasChanges = useMemo(() => markdown.trim() !== savedMarkdown.trim(), [markdown, savedMarkdown]);
  const isEmpty = markdown.trim().length === 0;

  function handleSave(nextMarkdown = markdown) {
    startTransition(async () => {
      try {
        setAutosaveState('saving');
        const trimmedMarkdown = nextMarkdown.trim() || DEFAULT_GOAL_MARKDOWN;
        const saved = await updateWorkspaceGoal(workspaceId, trimmedMarkdown);
        setMarkdown(saved.markdown?.trim() ? saved.markdown : DEFAULT_GOAL_MARKDOWN);
        setSavedMarkdown(saved.markdown?.trim() ? saved.markdown : DEFAULT_GOAL_MARKDOWN);
        setUpdatedAt(saved.updatedAt);
        setAutosaveState('saved');
      } catch (nextError) {
        console.error('Failed to save workspace goal:', nextError);
        setAutosaveState('error');
        toast.error(nextError instanceof Error ? nextError.message : 'Failed to save workspace goal');
      }
    });
  }

  useEffect(() => {
    if (isLoading) return;
    if (!hasChanges) {
      if (autosaveState !== 'saved') {
        setAutosaveState('idle');
      }
      return;
    }

    setAutosaveState('saving');
    if (autosaveDebounceRef.current) {
      clearTimeout(autosaveDebounceRef.current);
    }

    autosaveDebounceRef.current = setTimeout(() => {
      void handleSave(markdown);
    }, 900);

    return () => {
      if (autosaveDebounceRef.current) {
        clearTimeout(autosaveDebounceRef.current);
      }
    };
  }, [autosaveState, hasChanges, isLoading, markdown]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <p className="text-sm text-muted-foreground">Loading goal…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <Button type="button" variant="outline" size="sm" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-auto px-5 pt-5"
        onBlurCapture={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
          if (autosaveDebounceRef.current) {
            clearTimeout(autosaveDebounceRef.current);
          }
          if (hasChanges) {
            void handleSave(markdown);
          }
        }}
      >
        {isEmpty ? (
          <div className="pointer-events-none absolute inset-x-5 top-5 z-40">
            <div className="text-[2rem] leading-none font-semibold tracking-[-0.04em] text-muted-foreground/55">
              Title: New Goal
            </div>
            <div className="mt-6 text-[1rem] leading-7 text-muted-foreground/70">
              Add description...
            </div>
          </div>
        ) : null}
        <MarkdownEditor
          markdown={markdown}
          onChange={setMarkdown}
          placeholder=""
          bordered={false}
          className="bg-transparent"
          contentClassName="ownlab-goal-editor-content"
          autoFocus={false}
          onSubmit={() => {
            if (autosaveDebounceRef.current) {
              clearTimeout(autosaveDebounceRef.current);
            }
            if (hasChanges) {
              void handleSave(markdown);
            }
          }}
        />
        <div className="flex min-h-5 items-center justify-end gap-2 px-1 pb-3 pt-2 text-[11px] text-muted-foreground">
          <Check className="size-3.5" />
          <span>Last updated {formatGoalUpdatedAt(updatedAt)}</span>
          <span
            className={[
              'transition-opacity duration-150',
              autosaveState === 'error' ? 'text-destructive' : 'text-muted-foreground',
              autosaveState === 'idle' ? 'opacity-0' : 'opacity-100',
            ].join(' ')}
          >
            {autosaveState === 'saving'
              ? 'Autosaving...'
              : autosaveState === 'saved'
                ? 'Saved'
                : autosaveState === 'error'
                  ? 'Could not save'
                  : 'Idle'}
          </span>
        </div>
      </div>
    </div>
  );
}
