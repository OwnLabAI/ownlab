'use client';

import { FileText, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ViewboardTabsProps {
  openFilePaths: string[];
  activeFilePath: string | null;
  dirtyFilePaths?: string[];
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  className?: string;
  listClassName?: string;
  tabClassName?: string;
}

function getFileName(path: string) {
  return path.split('/').pop() ?? path;
}

export function ViewboardTabs({
  openFilePaths,
  activeFilePath,
  dirtyFilePaths,
  onSelect,
  onClose,
  className,
  listClassName,
  tabClassName,
}: ViewboardTabsProps) {
  const tabs = Array.isArray(openFilePaths) ? openFilePaths : [];
  const dirtyPaths = new Set(dirtyFilePaths ?? []);

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className={cn('desktop-window-drag shrink-0', className)}>
      <div
        className={cn(
          'desktop-window-drag flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
          listClassName,
        )}
      >
        {tabs.map((path) => {
          const isActive = path === activeFilePath;
          const isDirty = dirtyPaths.has(path);
          return (
            <div
              key={path}
              className={cn(
                'desktop-window-no-drag group relative flex h-8 min-w-0 max-w-[15rem] shrink-0 items-center gap-1.5 rounded-[4px] px-2 transition-[color,box-shadow,background-color,border-color] duration-150 ease-out',
                isActive
                  ? 'border border-border/70 bg-muted/55 text-foreground shadow-none'
                  : 'border border-transparent bg-transparent text-muted-foreground hover:bg-muted/25 hover:text-foreground',
                tabClassName,
              )}
            >
              <button
                type="button"
                className="desktop-window-no-drag flex min-w-0 flex-1 items-center gap-2 text-left"
                onClick={() => onSelect(path)}
                title={path}
              >
                <FileText
                  className={cn(
                    'size-3.5 shrink-0 transition-colors',
                    isActive ? 'text-foreground/90' : 'text-muted-foreground group-hover:text-foreground/85',
                  )}
                />
                <span className="truncate text-[0.8rem] font-medium leading-none">{getFileName(path)}</span>
                {isDirty ? (
                  <span
                    className={cn(
                      'size-1.5 shrink-0 rounded-full bg-current opacity-80 transition-opacity group-hover:opacity-0',
                    )}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn(
                  'desktop-window-no-drag size-5 shrink-0 rounded-[3px] p-0 text-muted-foreground/85 opacity-0 transition-[opacity,color,background-color] group-hover:opacity-100',
                  isDirty && 'group-hover:opacity-100',
                  isActive
                    ? 'hover:bg-background/80 hover:text-foreground'
                    : 'hover:bg-muted/45 hover:text-foreground',
                )}
                onClick={() => onClose(path)}
                aria-label={`Close ${getFileName(path)}`}
                title={`Close ${getFileName(path)}`}
              >
                <X className="size-3" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
