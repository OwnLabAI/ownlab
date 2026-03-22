'use client';

import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import {
  CodeMirrorEditor,
  MDXEditor,
  codeBlockPlugin,
  codeMirrorPlugin,
  type CodeBlockEditorDescriptor,
  type MDXEditorMethods,
  headingsPlugin,
  linkDialogPlugin,
  linkPlugin,
  listsPlugin,
  markdownShortcutPlugin,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
} from '@mdxeditor/editor';
import { cn } from '@/lib/utils';

export interface MdxEditorClientProps {
  markdown: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  bordered?: boolean;
  onBlur?: () => void;
  onSubmit?: () => void;
  autoFocus?: boolean;
}

export interface MdxEditorClientRef {
  focus: () => void;
}

const CODE_BLOCK_LANGUAGES: Record<string, string> = {
  txt: 'Text',
  md: 'Markdown',
  js: 'JavaScript',
  jsx: 'JavaScript (JSX)',
  ts: 'TypeScript',
  tsx: 'TypeScript (TSX)',
  json: 'JSON',
  bash: 'Bash',
  sh: 'Shell',
  python: 'Python',
  go: 'Go',
  rust: 'Rust',
  sql: 'SQL',
  html: 'HTML',
  css: 'CSS',
  yaml: 'YAML',
  yml: 'YAML',
};

const FALLBACK_CODE_BLOCK_DESCRIPTOR: CodeBlockEditorDescriptor = {
  priority: 0,
  match: () => true,
  Editor: CodeMirrorEditor,
};

export const MdxEditorClient = forwardRef<MdxEditorClientRef, MdxEditorClientProps>(function MdxEditorClient({
  markdown,
  onChange,
  placeholder,
  className,
  contentClassName,
  bordered = true,
  onBlur,
  onSubmit,
  autoFocus = false,
}: MdxEditorClientProps, forwardedRef) {
  const editorRef = useRef<MDXEditorMethods>(null);

  useImperativeHandle(
    forwardedRef,
    () => ({
      focus: () => {
        editorRef.current?.focus(undefined, { defaultSelection: 'rootEnd' });
      },
    }),
    [],
  );

  const plugins = useMemo(
    () => [
      headingsPlugin(),
      listsPlugin(),
      quotePlugin(),
      thematicBreakPlugin(),
      linkPlugin(),
      linkDialogPlugin(),
      tablePlugin(),
      codeBlockPlugin({
        defaultCodeBlockLanguage: 'txt',
        codeBlockEditorDescriptors: [FALLBACK_CODE_BLOCK_DESCRIPTOR],
      }),
      codeMirrorPlugin({ codeBlockLanguages: CODE_BLOCK_LANGUAGES }),
      markdownShortcutPlugin(),
    ],
    [],
  );

  return (
    <div
      className={cn(
        'ownlab-mdxeditor',
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
      <MDXEditor
        ref={editorRef}
        markdown={markdown}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onBlur={onBlur}
        className={cn(!bordered && 'ownlab-mdxeditor--borderless')}
        contentEditableClassName={cn(
          'ownlab-mdxeditor-content focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:list-item',
          contentClassName,
        )}
        plugins={plugins}
      />
    </div>
  );
});
