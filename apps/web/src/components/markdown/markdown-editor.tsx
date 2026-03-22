'use client';

import { forwardRef } from 'react';
import { MdxEditorClient, type MdxEditorClientRef } from './mdx-editor-client';

export interface MarkdownEditorProps {
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

export type MarkdownEditorRef = MdxEditorClientRef;

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(function MarkdownEditor(
  props,
  ref,
) {
  return <MdxEditorClient ref={ref} {...props} />;
});
