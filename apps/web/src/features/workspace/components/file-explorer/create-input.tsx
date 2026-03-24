'use client';

import { useState } from 'react';
import { ChevronRight, File, Folder } from 'lucide-react';
import { getItemPadding } from './constants';

export function CreateInput({
  type,
  level,
  onSubmit,
  onCancel,
}: {
  type: 'file' | 'folder';
  level: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState('');

  const handleSubmit = () => {
    const trimmedValue = value.trim();
    if (trimmedValue) {
      onSubmit(trimmedValue);
    } else {
      onCancel();
    }
  };

  return (
    <div
      className="flex h-10 w-full items-center gap-2 rounded-xl border border-border/50 bg-card/90 pr-2 shadow-[0_6px_14px_rgba(15,23,42,0.04)] dark:shadow-[0_8px_18px_rgba(0,0,0,0.24)]"
      style={{ paddingLeft: getItemPadding(level, type === 'file') }}
    >
      <div className="flex shrink-0 items-center gap-0.5">
        {type === 'folder' && (
          <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        )}
        {type === 'file' && <File className="size-4 shrink-0 text-muted-foreground" />}
        {type === 'folder' && <Folder className="size-4 shrink-0 fill-primary/15 text-primary" />}
      </div>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none"
        onBlur={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
      />
    </div>
  );
}
