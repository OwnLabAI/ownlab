'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { FolderOpen, LibraryBig, ListTodo, MoreHorizontal, Target, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useWorkspaceView } from '@/features/workspace/stores/use-workspace-view-store';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarContent } from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { ToolPanelChannels } from './tool-panel-channels';
import { FileExplorer } from './file-explorer';
import { ToolPanelGoal } from './tool-panel-goal';
import { ToolPanelPlugins } from './tool-panel-plugins';
import { ToolPanelTasks } from './tool-panel-tasks';
import { browseWorkspaceFolder, updateWorkspaceApi } from '@/lib/api';
import type { Item } from '@/features/workspace/data/items';
import type { WorkspaceForSwitcher } from '@/features/lab/data/workspaces';

const TABS = [
  { id: 'file', label: 'Files', icon: FolderOpen },
  { id: 'plugins', label: 'Plugins', icon: LibraryBig },
  { id: 'tasks', label: 'Tasks', icon: ListTodo },
  { id: 'goal', label: 'Goal', icon: Target },
  { id: 'members', label: 'Channels', icon: Users },
] as const;

type TabId = (typeof TABS)[number]['id'];

const TAB_GAP = 4;
const MORE_BUTTON_WIDTH = 40;

interface ToolPanelProps {
  items: Item[];
  workspaces: WorkspaceForSwitcher[];
  onFileSelect?: (path: string | null) => void;
  onTaskSelect?: (taskId: string | null) => void;
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

export function ToolPanel({
  items: _initialItems,
  workspaces,
  onFileSelect,
  onTaskSelect,
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
    setSelectedTaskId,
    setSelectedPluginId,
    selectedTaskId,
    selectedPluginId,
  } = useWorkspaceView(workspaceId);
  const handleFileSelect = onFileSelect ?? setSelectedFilePath;
  const handleTaskSelect = onTaskSelect ?? setSelectedTaskId;
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const measureRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const [layout, setLayout] = useState<{
    visibleTabIds: TabId[];
    hiddenTabIds: TabId[];
  }>({
    visibleTabIds: TABS.map((tab) => tab.id),
    hiddenTabIds: [],
  });

  useEffect(() => {
    const container = tabsRef.current;
    if (!container) {
      return;
    }

    const updateLayout = () => {
      const containerWidth = container.clientWidth;
      if (!containerWidth) {
        return;
      }

      const widthById = Object.fromEntries(
        TABS.map((tab) => [tab.id, measureRefs.current[tab.id]?.offsetWidth ?? 96]),
      ) as Record<TabId, number>;

      let used = 0;
      let directCount = 0;

      for (let index = 0; index < TABS.length; index += 1) {
        const tab = TABS[index];
        const gapBefore = directCount > 0 ? TAB_GAP : 0;
        const nextUsed = used + gapBefore + widthById[tab.id];
        const remainingTabs = TABS.length - (index + 1);
        const reserveForMore = remainingTabs > 0 ? TAB_GAP + MORE_BUTTON_WIDTH : 0;

        if (nextUsed + reserveForMore <= containerWidth) {
          used = nextUsed;
          directCount += 1;
          continue;
        }

        break;
      }

      if (directCount >= TABS.length) {
        const nextVisible = TABS.map((tab) => tab.id);
        setLayout((current) => (
          current.hiddenTabIds.length === 0 &&
          current.visibleTabIds.length === nextVisible.length &&
          current.visibleTabIds.every((tabId, index) => tabId === nextVisible[index])
            ? current
            : { visibleTabIds: nextVisible, hiddenTabIds: [] }
        ));
        return;
      }

      directCount = Math.max(1, directCount);
      const leadingIds = TABS.slice(0, directCount).map((tab) => tab.id);

      let nextVisible = leadingIds;
      if (!nextVisible.includes(activeToolTab)) {
        nextVisible = [...leadingIds.slice(0, Math.max(0, directCount - 1)), activeToolTab];
      }

      nextVisible = TABS
        .map((tab) => tab.id)
        .filter((tabId, index, ids) => nextVisible.includes(tabId) && ids.indexOf(tabId) === index)
        .slice(0, directCount);

      const nextHidden = TABS
        .map((tab) => tab.id)
        .filter((tabId) => !nextVisible.includes(tabId));

      setLayout((current) => (
        current.visibleTabIds.length === nextVisible.length &&
        current.hiddenTabIds.length === nextHidden.length &&
        current.visibleTabIds.every((tabId, index) => tabId === nextVisible[index]) &&
        current.hiddenTabIds.every((tabId, index) => tabId === nextHidden[index])
          ? current
          : { visibleTabIds: nextVisible, hiddenTabIds: nextHidden }
      ));
    };

    updateLayout();

    const resizeObserver = new ResizeObserver(updateLayout);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [activeToolTab]);

  const visibleTabs = TABS.filter((tab) => layout.visibleTabIds.includes(tab.id));
  const hiddenTabs = TABS.filter((tab) => layout.hiddenTabIds.includes(tab.id));
  const useCompactToolbar = hiddenTabs.length > 0 && visibleTabs.length <= 2;

  return (
    <div className="relative flex h-full w-full min-h-0 flex-col bg-transparent px-2 py-2">
      <div
        ref={tabsRef}
        className={cn(
          'mb-2.5 h-10 shrink-0 overflow-hidden rounded-full bg-background/70 px-1 py-0.5',
          useCompactToolbar
            ? 'flex items-center gap-1.5'
            : hiddenTabs.length > 0
              ? 'grid items-center gap-1'
              : 'grid items-center gap-1',
        )}
        style={
          useCompactToolbar
            ? undefined
            : hiddenTabs.length > 0
              ? { gridTemplateColumns: `repeat(${Math.max(1, visibleTabs.length)}, minmax(0, 1fr)) auto` }
              : { gridTemplateColumns: `repeat(${Math.max(1, visibleTabs.length)}, minmax(0, 1fr))` }
        }
      >
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveToolTab(tab.id)}
            className={cn(
              'flex min-w-0 items-center justify-center gap-1.5 rounded-full px-2.5 py-1.5 text-[13px] font-medium transition-all',
              useCompactToolbar && 'flex-none px-4',
              activeToolTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
            )}
          >
            <tab.icon className="size-3.5" />
            <span className="truncate">{tab.label}</span>
          </button>
        ))}

        {hiddenTabs.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-background/70 hover:text-foreground',
                  useCompactToolbar ? 'ml-auto size-8.5 shrink-0' : 'h-full min-w-0 px-2',
                )}
                aria-label="More tools"
                title="More tools"
              >
                <MoreHorizontal className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              {hiddenTabs.map((tab) => (
                <DropdownMenuItem
                  key={tab.id}
                  onClick={() => setActiveToolTab(tab.id)}
                  className="cursor-pointer"
                >
                  <tab.icon className="size-4" />
                  <span className="flex-1">{tab.label}</span>
                  {activeToolTab === tab.id ? (
                    <span className="text-[11px] text-muted-foreground">Current</span>
                  ) : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>

      <div className="pointer-events-none absolute left-0 top-0 -z-10 opacity-0">
        {TABS.map((tab) => (
          <button
            key={`measure-${tab.id}`}
            ref={(node) => {
              measureRefs.current[tab.id] = node;
            }}
            type="button"
            className="flex items-center justify-center gap-1.5 rounded-full px-4 py-1.5 text-[13px] font-medium"
          >
            <tab.icon className="size-3.5" />
            <span>{tab.label}</span>
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
          <ToolPanelChannels />
        )}

        {activeToolTab === 'plugins' && (
          <ToolPanelPlugins
            workspaceId={workspaceId}
            selectedPluginId={selectedPluginId}
            onPluginSelect={setSelectedPluginId}
          />
        )}

        {activeToolTab === 'tasks' && currentWorkspace && (
          <ToolPanelTasks
            workspace={currentWorkspace}
            selectedTaskId={selectedTaskId}
            onTaskSelect={handleTaskSelect}
          />
        )}

        {activeToolTab === 'goal' && (
          <ToolPanelGoal workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}
