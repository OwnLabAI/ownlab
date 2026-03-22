'use client';

import { useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FolderOpen, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspaceView } from '@/features/workspace/stores/use-workspace-view-store';
import { Button } from '@/components/ui/button';
import { SidebarContent } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { ToolPanelMembers } from './tool-panel-members';
import { FileExplorer } from './file-explorer';
import { browseWorkspaceFolder, updateWorkspaceApi } from '@/lib/api';
import type { Item } from '@/features/workspace/data/items';
import type { WorkspaceForSwitcher } from '@/features/lab/data/workspaces';

const TABS = [
  { id: 'file', label: 'Files', icon: FolderOpen },
  { id: 'members', label: 'Members', icon: Users },
] as const;

type TabId = (typeof TABS)[number]['id'];

interface ToolPanelProps {
  items: Item[];
  workspaces: WorkspaceForSwitcher[];
  onFileSelect?: (path: string | null) => void;
}

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
      <div className="mb-4 rounded-2xl bg-white/75 p-4 shadow-[0_6px_18px_rgba(15,23,42,0.05)]">
        <FolderOpen className="size-7 text-[#747474]" />
      </div>
      <h3 className="text-base font-semibold text-[#3f3f3f]">Link a local folder</h3>
      <p className="mt-2 max-w-xs text-sm leading-6 text-[#8a8a8a]">
        Choose the workspace folder on your machine and the File panel will mirror it like VS Code.
      </p>
      <Button
        type="button"
        className="mt-5 rounded-full border-0 bg-white px-5 text-[#3f3f3f] shadow-[0_6px_18px_rgba(15,23,42,0.05)] hover:bg-white/95"
        disabled={isPending}
        onClick={handleSelectFolder}
      >
        {isPending ? 'Opening…' : 'Select Folder'}
      </Button>
    </div>
  );
}

export function ToolPanel({
  items: _initialItems,
  workspaces,
  onFileSelect,
}: ToolPanelProps) {
  const params = useParams();
  const workspaceId = params.workspaceId as string;
  const isValid = !!workspaceId;
  const currentWorkspace = workspaces.find((w) => w.id === workspaceId);
  const hasWorktreePath = !!currentWorkspace?.worktreePath?.trim();

  const {
    activeToolTab,
    setActiveToolTab,
    setSelectedFilePath,
  } = useWorkspaceView(workspaceId);
  const handleFileSelect = onFileSelect ?? setSelectedFilePath;

  return (
    <div className="flex h-full w-full min-h-0 flex-col bg-transparent px-2 py-2">
      <div className="mb-3 flex h-12 shrink-0 items-center gap-1 rounded-full bg-background/70 p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveToolTab(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-all',
              activeToolTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
            )}
          >
            <tab.icon className="size-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 flex flex-col overflow-hidden">
        {activeToolTab === 'file' && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <SidebarContent className="flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-transparent">
              {hasWorktreePath ? (
                <FileExplorer
                  workspaceId={workspaceId}
                  workspaceName={currentWorkspace?.name ?? 'Files'}
                  onFileSelect={handleFileSelect}
                />
              ) : isValid ? (
                <WorkspaceFolderSetup workspaceId={workspaceId} />
              ) : null}
            </SidebarContent>
          </div>
        )}

        {activeToolTab === 'members' && (
          <ToolPanelMembers />
        )}
      </div>
    </div>
  );
}
