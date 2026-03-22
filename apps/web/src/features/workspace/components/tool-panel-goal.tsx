'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { MarkdownEditor, type MarkdownEditorRef } from '@/components/markdown';
import { Button } from '@/components/ui/button';
import { fetchWorkspaceGoal, updateWorkspaceGoal } from '@/lib/api';

const DEFAULT_GOAL_MARKDOWN = '';
const AUTOSAVE_DEBOUNCE_MS = 900;

function normalizeGoalMarkdown(value: string) {
  return value.replace(/\r\n?/g, '\n').trim();
}

function parseGoalMarkdown(markdown: string | null | undefined) {
  const normalized = normalizeGoalMarkdown(markdown ?? '');
  if (!normalized) {
    return { title: '', description: '' };
  }

  const headingMatch = normalized.match(/^#\s+(.+?)(?:\n+([\s\S]*))?$/);
  if (!headingMatch) {
    return { title: '', description: normalized };
  }

  return {
    title: headingMatch[1].trim(),
    description: (headingMatch[2] ?? '').trim(),
  };
}

function composeGoalMarkdown(title: string, description: string) {
  const trimmedTitle = title.trim();
  const trimmedDescription = description.trim();

  if (trimmedTitle && trimmedDescription) {
    return `# ${trimmedTitle}\n\n${trimmedDescription}`;
  }

  if (trimmedTitle) {
    return `# ${trimmedTitle}`;
  }

  return trimmedDescription;
}

export function ToolPanelGoal({ workspaceId }: { workspaceId: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [savedMarkdown, setSavedMarkdown] = useState(DEFAULT_GOAL_MARKDOWN);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autosaveDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const titleInputRef = useRef<HTMLTextAreaElement | null>(null);
  const descriptionEditorRef = useRef<MarkdownEditorRef>(null);

  const markdown = useMemo(() => composeGoalMarkdown(title, description), [description, title]);
  const hasChanges = useMemo(
    () => normalizeGoalMarkdown(markdown) !== normalizeGoalMarkdown(savedMarkdown),
    [markdown, savedMarkdown],
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    fetchWorkspaceGoal(workspaceId)
      .then((goal) => {
        if (cancelled) return;
        const nextMarkdown = goal.markdown?.trim() ? goal.markdown : DEFAULT_GOAL_MARKDOWN;
        const parsed = parseGoalMarkdown(nextMarkdown);
        setTitle(parsed.title);
        setDescription(parsed.description);
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

  useEffect(() => {
    const element = titleInputRef.current;
    if (!element) return;
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  }, [title]);

  function handleSave(nextMarkdown = markdown) {
    startTransition(async () => {
      try {
        setAutosaveState('saving');
        const trimmedMarkdown = normalizeGoalMarkdown(nextMarkdown) || DEFAULT_GOAL_MARKDOWN;
        const saved = await updateWorkspaceGoal(workspaceId, trimmedMarkdown);
        const nextSavedMarkdown = saved.markdown?.trim() ? saved.markdown : DEFAULT_GOAL_MARKDOWN;
        const parsed = parseGoalMarkdown(nextSavedMarkdown);
        setTitle(parsed.title);
        setDescription(parsed.description);
        setSavedMarkdown(nextSavedMarkdown);
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
    }, AUTOSAVE_DEBOUNCE_MS);

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
        className="flex min-h-0 flex-1 flex-col overflow-auto"
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
        <div className="shrink-0 px-4 pb-2 pt-4">
          <textarea
            ref={titleInputRef}
            value={title}
            rows={1}
            placeholder="New Goal"
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                descriptionEditorRef.current?.focus();
                return;
              }
              if (event.key === 'Tab' && !event.shiftKey) {
                event.preventDefault();
                descriptionEditorRef.current?.focus();
              }
            }}
            className="ownlab-goal-title-input"
          />
        </div>
        <div className="px-4 pb-2">
          <MarkdownEditor
            ref={descriptionEditorRef}
            markdown={description}
            onChange={setDescription}
            placeholder="Add description..."
            bordered={false}
            className="bg-transparent"
            contentClassName="ownlab-goal-editor-content text-sm text-muted-foreground min-h-[120px]"
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
        </div>
      </div>
    </div>
  );
}
