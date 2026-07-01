'use client';

import { forwardRef, useImperativeHandle, useRef, useState, type ForwardedRef } from 'react';
import { defaultValueCtx, Editor, editorViewCtx, editorViewOptionsCtx, rootCtx } from '@milkdown/core';
import { clipboard } from '@milkdown/plugin-clipboard';
import { history } from '@milkdown/plugin-history';
import { listener, listenerCtx } from '@milkdown/plugin-listener';
import { commonmark } from '@milkdown/preset-commonmark';
import { gfm } from '@milkdown/preset-gfm';
import { Milkdown, MilkdownProvider, useEditor, useInstance } from '@milkdown/react';
import { cn } from '@/lib/utils';

export interface MilkdownEditorClientProps {
  markdown: string;
  onChange: (value: string, details?: { initialMarkdownNormalize: boolean }) => void;
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  bordered?: boolean;
  onBlur?: () => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
}

export interface MilkdownEditorClientRef {
  focus: () => void;
}

interface MilkdownEditorInnerProps extends MilkdownEditorClientProps {
  forwardedRef: ForwardedRef<MilkdownEditorClientRef>;
}

function MilkdownEditorInner({
  markdown,
  onChange,
  placeholder,
  className,
  contentClassName,
  bordered = true,
  onBlur,
  onSubmit,
  autoFocus = false,
  forwardedRef,
}: MilkdownEditorInnerProps) {
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const initialMarkdownRef = useRef(markdown);
  const isBootstrappingRef = useRef(true);
  const [isFocused, setIsFocused] = useState(false);
  const [isEmpty, setIsEmpty] = useState(() => markdown.trim().length === 0);
  const [loading, getEditor] = useInstance();

  onChangeRef.current = onChange;
  onBlurRef.current = onBlur;

  useEditor((root) => {
    return Editor.make()
      .use(commonmark)
      .use(gfm)
      .use(listener)
      .use(history)
      .use(clipboard)
      .config((ctx) => {
        ctx.set(rootCtx, root);
        ctx.set(defaultValueCtx, initialMarkdownRef.current);
        ctx.set(editorViewOptionsCtx, {
          editable: () => true,
          attributes: {
            spellcheck: 'true',
          },
        });

        const listeners = ctx.get(listenerCtx);
        listeners.mounted(() => {
          setIsEmpty(initialMarkdownRef.current.trim().length === 0);
          queueMicrotask(() => {
            isBootstrappingRef.current = false;
            if (autoFocus) {
              ctx.get(editorViewCtx).focus();
            }
          });
        });
        listeners.markdownUpdated((_listenerCtx, nextMarkdown) => {
          setIsEmpty(nextMarkdown.trim().length === 0);

          if (isBootstrappingRef.current) {
            return;
          }

          onChangeRef.current(nextMarkdown, { initialMarkdownNormalize: false });
        });
        listeners.focus(() => {
          setIsFocused(true);
        });
        listeners.blur(() => {
          setIsFocused(false);
          onBlurRef.current?.();
        });
      });
  }, []);

  useImperativeHandle(
    forwardedRef,
    () => ({
      focus: () => {
        if (loading) {
          return;
        }

        const editor = getEditor();
        editor?.action((ctx) => {
          ctx.get(editorViewCtx).focus();
        });
      },
    }),
    [getEditor, loading],
  );

  return (
    <div
      className={cn(
        'ownlab-milkdown relative',
        bordered ? 'rounded-2xl border bg-background' : 'bg-transparent',
        className,
      )}
      onKeyDownCapture={(event) => {
        if (onSubmit && event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          event.stopPropagation();
          onSubmit();
        }
      }}
    >
      {placeholder && !isFocused && isEmpty ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-0 py-0 text-sm text-muted-foreground/70">
          {placeholder}
        </div>
      ) : null}
      <div className={cn('ownlab-milkdown-surface', contentClassName)}>
        <Milkdown />
      </div>
    </div>
  );
}

export const MilkdownEditorClient = forwardRef<MilkdownEditorClientRef, MilkdownEditorClientProps>(
  function MilkdownEditorClient(props, ref) {
    return (
      <MilkdownProvider>
        <MilkdownEditorInner {...props} forwardedRef={ref} />
      </MilkdownProvider>
    );
  },
);
