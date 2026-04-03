'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { BookOpenText, FolderOpen, ListTodo, MoreHorizontal, Target, Users } from 'lucide-react';
import { useWorkspaceView } from '@/features/workspace/stores/use-workspace-view-store';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { ChannelsPanel } from './channels-panel';
import { FilesPanel } from './files-panel';
import { GoalPanel } from './goal-panel';
import { SourcesPanel } from './sources-panel';
import { TasksPanel } from './tasks-panel';
import type { Item } from '@/features/workspace/data/items';
import type { WorkspaceForSwitcher } from '@/features/lab/data/workspaces';

const TABS = [
  { id: 'file', label: 'Files', icon: FolderOpen },
  { id: 'sources', label: 'Sources', icon: BookOpenText },
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
  onSourceSelect?: (sourceId: string | null) => void;
  onTaskSelect?: (taskId: string | null) => void;
}

function PluginTestingNotice() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <p className="text-sm text-muted-foreground">Plugins are still in testing.</p>
    </div>
  );
}

export function ToolPanel({
  items: _initialItems,
  workspaces,
  onFileSelect,
  onSourceSelect,
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
    setSelectedSourceId,
    setSelectedTaskId,
    setSelectedPluginId,
    selectedSourceId,
    selectedTaskId,
    selectedPluginId,
  } = useWorkspaceView(workspaceId);
  const handleFileSelect = onFileSelect ?? setSelectedFilePath;
  const handleSourceSelect = onSourceSelect ?? setSelectedSourceId;
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
      const activeToolbarTab = (
        TABS.some((tab) => tab.id === activeToolTab) ? activeToolTab : 'file'
      ) as TabId;
      if (!nextVisible.includes(activeToolbarTab)) {
        nextVisible = [...leadingIds.slice(0, Math.max(0, directCount - 1)), activeToolbarTab];
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
  const activeToolbarTab = (
    TABS.some((tab) => tab.id === activeToolTab) ? activeToolTab : 'file'
  ) as TabId;

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
              activeToolbarTab === tab.id
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
                  {activeToolbarTab === tab.id ? (
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
          <FilesPanel
            workspaceId={workspaceId}
            workspaceName={currentWorkspace?.name ?? 'Files'}
            hasWorktreePath={hasWorktreePath && isValid}
            onFileSelect={handleFileSelect}
          />
        )}

        {activeToolTab === 'members' && (
          <ChannelsPanel />
        )}

        {activeToolTab === 'sources' && (
          <SourcesPanel
            workspaceId={workspaceId}
            selectedSourceId={selectedSourceId}
            onSourceSelect={handleSourceSelect}
          />
        )}

        {activeToolTab === 'plugins' && <PluginTestingNotice />}

        {activeToolTab === 'tasks' && currentWorkspace && (
          <TasksPanel
            workspace={currentWorkspace}
            selectedTaskId={selectedTaskId}
            onTaskSelect={handleTaskSelect}
          />
        )}

        {activeToolTab === 'goal' && (
          <GoalPanel workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}
