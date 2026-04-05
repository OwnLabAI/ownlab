'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { FolderOpen } from 'lucide-react';
import { toast } from 'sonner';
import { SidebarContent } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { browseWorkspaceFolder, updateWorkspaceApi } from '@/lib/api';
import { FileExplorer } from '../file-explorer';

function WorkspaceFolderSetup({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSelectFolder() {
    startTransition(async () => {
      try {
        const folder = await browseWorkspaceFolder();
        if (!folder?.path) {
          return;
        }

        await updateWorkspaceApi(workspaceId, { worktreePath: folder.path });
        toast.success(`Linked folder "${folder.name}".`);
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to link folder');
      }
    });
  }

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 rounded-2xl border border-border/50 bg-card/80 p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
        <FolderOpen className="size-7 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground">Link a local folder</h3>
      <p className="mt-2 max-w-xs text-sm leading-6 text-muted-foreground">
        Choose the workspace folder on your machine and the File panel will mirror it like VS Code.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-5 rounded-full border-border/60 bg-background/90 px-5 shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:bg-accent/70 dark:bg-card/80 dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]"
        disabled={isPending}
        onClick={handleSelectFolder}
      >
        {isPending ? 'Opening…' : 'Select Folder'}
      </Button>
    </div>
  );
}

export function FilesPanel({
  workspaceId,
  workspaceName,
  hasWorktreePath,
  onFileSelect,
}: {
  workspaceId: string;
  workspaceName: string;
  hasWorktreePath: boolean;
  onFileSelect: (path: string | null) => void;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <SidebarContent className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-transparent">
        {hasWorktreePath ? (
          <FileExplorer
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            onFileSelect={onFileSelect}
          />
        ) : (
          <WorkspaceFolderSetup workspaceId={workspaceId} />
        )}
      </SidebarContent>
    </div>
  );
}
