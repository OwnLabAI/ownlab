'use client';

import { CodeEditor } from './code-editor';

interface CodeFileViewProps {
  filePath: string;
  content: string;
  onChange: (nextContent: string) => void;
  onSave: () => void | Promise<void>;
}

export function CodeFileView({ filePath, content, onChange, onSave }: CodeFileViewProps) {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden"
      onKeyDownCapture={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
          event.preventDefault();
          event.stopPropagation();
          void onSave();
        }
      }}
    >
      <header className="flex shrink-0 items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur">
        <h2 className="truncate text-sm font-medium text-foreground/88">{filePath.split('/').pop() ?? filePath}</h2>
      </header>
      <div className="min-h-0 flex-1 border-t-0">
        <CodeEditor
          filePath={filePath}
          value={content}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
