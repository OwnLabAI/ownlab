'use client';

import {
  MDXEditor,
  codeBlockPlugin,
  codeMirrorPlugin,
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

export function MdxEditorClient({
  markdown,
  onChange,
  placeholder,
  className,
  contentClassName,
  bordered = true,
  onBlur,
  onSubmit,
  autoFocus = false,
}: MdxEditorClientProps) {
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
        markdown={markdown}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onBlur={onBlur}
        className={cn(!bordered && 'ownlab-mdxeditor--borderless')}
        contentEditableClassName={cn(
          'prose prose-sm max-w-none min-h-[280px] px-4 py-3 focus:outline-none',
          contentClassName,
        )}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          tablePlugin(),
          codeBlockPlugin(),
          codeMirrorPlugin({ codeBlockLanguages: CODE_BLOCK_LANGUAGES }),
          markdownShortcutPlugin(),
        ]}
      />
    </div>
  );
}
