'use client';

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, placeholder } from '@codemirror/view';
import { indentUnit } from '@codemirror/language';
import { indentWithTab } from '@codemirror/commands';
import { keymap } from '@codemirror/view';
import { customSetup } from './custom-setup';
import { resolveCodeLanguage, type CodeLanguage } from './language-extension';

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'var(--font-mono)',
    lineHeight: '1.5rem',
  },
  '.cm-content, .cm-line': {
    fontFamily: 'var(--font-mono)',
  },
  '.cm-content': {
    minHeight: '100%',
    padding: '0.9rem 0',
    caretColor: 'var(--foreground)',
  },
  '.cm-lineWrapping': {
    whiteSpace: 'break-spaces',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word',
  },
  '.cm-gutters': {
    border: 'none',
    backgroundColor: 'transparent',
    color: 'color-mix(in oklab, var(--muted-foreground) 88%, transparent)',
    paddingRight: '10px',
  },
  '.cm-lineNumbers .cm-gutterElement': {
    padding: '0 10px 0 16px',
  },
  '.cm-foldGutter .cm-gutterElement': {
    padding: '0 4px 0 0',
  },
  '.cm-activeLineGutter': {
    backgroundColor: 'transparent',
    color: 'var(--foreground)',
  },
  '.cm-activeLine': {
    backgroundColor: 'color-mix(in oklab, var(--accent) 18%, transparent)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, & .cm-selectionBackground': {
    backgroundColor: 'color-mix(in oklab, var(--ring) 24%, transparent)',
  },
  '&.cm-focused': {
    outline: 'none',
  },
  '.cm-cursor, .cm-dropCursor': {
    borderLeftColor: 'var(--foreground)',
  },
  '.cm-tooltip': {
    border: '1px solid var(--border)',
    backgroundColor: 'var(--popover)',
    color: 'var(--popover-foreground)',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-md)',
  },
  '.cm-tooltip-autocomplete ul li[aria-selected]': {
    backgroundColor: 'color-mix(in oklab, var(--accent) 32%, transparent)',
    color: 'var(--foreground)',
  },
  '.cm-placeholder': {
    color: 'var(--muted-foreground)',
    paddingLeft: '16px',
  },
  '.cm-panels': {
    backgroundColor: 'var(--background)',
    color: 'var(--foreground)',
  },
});

export interface CodeEditorRef {
  focus: () => void;
  focusLine: (line: number) => void;
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholderText?: string;
  filePath?: string;
  language?: CodeLanguage;
}

export const CodeEditor = forwardRef<CodeEditorRef, CodeEditorProps>(function CodeEditor(
  { value, onChange, onBlur, placeholderText, filePath, language },
  forwardedRef,
) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onBlurRef = useRef(onBlur);
  const languageExtension = useMemo(() => resolveCodeLanguage(filePath, language), [filePath, language]);

  onChangeRef.current = onChange;
  onBlurRef.current = onBlur;

  useImperativeHandle(
    forwardedRef,
    () => ({
      focus: () => {
        viewRef.current?.focus();
      },
      focusLine: (line: number) => {
        const view = viewRef.current;
        if (!view) {
          return;
        }

        const safeLine = Math.max(1, Math.min(line, view.state.doc.lines));
        const targetLine = view.state.doc.line(safeLine);
        view.dispatch({
          selection: { anchor: targetLine.from, head: targetLine.to },
          scrollIntoView: true,
        });
        view.focus();
      },
    }),
    [],
  );

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          customSetup,
          keymap.of([indentWithTab]),
          languageExtension,
          EditorView.lineWrapping,
          indentUnit.of('  '),
          editorTheme,
          EditorState.tabSize.of(2),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString());
            }
          }),
          EditorView.domEventHandlers({
            blur: () => {
              onBlurRef.current?.();
            },
          }),
          ...(placeholderText ? [placeholder(placeholderText)] : []),
        ],
      }),
      parent: hostRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [languageExtension, placeholderText]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) {
      return;
    }

    const currentValue = view.state.doc.toString();
    if (currentValue === value) {
      return;
    }

    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value,
      },
    });
  }, [value]);

  return (
    <div
      ref={hostRef}
      className="ownlab-code-editor-scroll h-full min-h-[24rem] w-full overflow-hidden bg-transparent"
    />
  );
});
