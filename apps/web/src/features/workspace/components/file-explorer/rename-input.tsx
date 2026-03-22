'use client';

import { useState } from 'react';
import { ChevronRight, File, Folder } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getItemPadding } from './constants';

export function RenameInput({
  type,
  defaultValue,
  isOpen,
  level,
  onSubmit,
  onCancel,
}: {
  type: 'file' | 'folder';
  defaultValue: string;
  isOpen?: boolean;
  level: number;
  onSubmit: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);

  const handleSubmit = () => {
    const trimmedValue = value.trim() || defaultValue;
    onSubmit(trimmedValue);
  };

  return (
    <div
      className="flex h-10 w-full items-center gap-2 rounded-xl bg-white/88 pr-2 shadow-[0_6px_14px_rgba(15,23,42,0.04)]"
      style={{ paddingLeft: getItemPadding(level, type === 'file') }}
    >
      <div className="flex shrink-0 items-center gap-0.5">
        {type === 'folder' && (
          <ChevronRight
            className={cn(
              'size-4 shrink-0 text-muted-foreground',
              isOpen && 'rotate-90',
            )}
          />
        )}
        {type === 'file' && <File className="size-4 shrink-0 text-[#8a8a8a]" />}
        {type === 'folder' && <Folder className="size-4 shrink-0 fill-[#d8ebff] text-[#4a90e2]" />}
      </div>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
        onBlur={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') onCancel();
        }}
        onFocus={(e) => {
          if (type === 'folder') {
            e.currentTarget.select();
          } else {
            const val = e.currentTarget.value;
            const lastDot = val.lastIndexOf('.');
            if (lastDot > 0) {
              e.currentTarget.setSelectionRange(0, lastDot);
            } else {
              e.currentTarget.select();
            }
          }
        }}
      />
    </div>
  );
}
