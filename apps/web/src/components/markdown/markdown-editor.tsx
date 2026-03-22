'use client';

import dynamic from 'next/dynamic';

const DynamicMdxEditorClient = dynamic(
  () => import('./mdx-editor-client').then((mod) => mod.MdxEditorClient),
  { ssr: false },
);

interface MarkdownEditorProps {
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

export function MarkdownEditor(props: MarkdownEditorProps) {
  return <DynamicMdxEditorClient {...props} />;
}
