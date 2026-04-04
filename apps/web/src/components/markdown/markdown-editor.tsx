'use client';

import { forwardRef } from 'react';
import dynamic from 'next/dynamic';
import type { MdxEditorClientProps, MdxEditorClientRef } from './mdx-editor-client';

const LazyMdxEditorClient = dynamic(
  () => import('./mdx-editor-client').then((mod) => mod.MdxEditorClient),
  {
    loading: () => <div className="min-h-[12rem] rounded-2xl border bg-background/50" />,
    ssr: false,
  },
);

export type MarkdownEditorProps = MdxEditorClientProps;

export type MarkdownEditorRef = MdxEditorClientRef;

export const MarkdownEditor = forwardRef<MarkdownEditorRef, MarkdownEditorProps>(function MarkdownEditor(
  props,
  ref,
) {
  return <LazyMdxEditorClient ref={ref} {...props} />;
});
