'use client';

import Link from 'next/link';
import { useState } from 'react';
import { PanelLeft, PanelRight } from 'lucide-react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { ToolPanel } from './tool-panel';
import { Viewboard } from './viewboard';
import { useWorkspaceView } from '@/features/workspace/stores/use-workspace-view-store';
import type { Item } from '@/features/workspace/data/items';
import type { WorkspaceForSwitcher } from '@/features/lab/data/workspaces';

interface WorkspaceContainerProps {
  workspaceId: string;
  items: Item[];
  workspaces: WorkspaceForSwitcher[];
  children: React.ReactNode;
}

const CARD_CLASS =
  'flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-black/5 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]';

function WorkspaceTopBar({
  toolPanelOpen,
  onToggleToolPanel,
  channelOpen,
  onToggleChannel,
}: {
  toolPanelOpen: boolean;
  onToggleToolPanel: () => void;
  channelOpen: boolean;
  onToggleChannel: () => void;
}) {
  return (
    <div className="flex h-12 shrink-0 items-center justify-between px-2 pt-2">
      <div className="flex items-center gap-2">
        <Link
          href="/lab/workspaces"
          className="flex size-8 items-center justify-center rounded-md text-foreground transition-colors hover:bg-transparent hover:text-foreground"
          aria-label="Back to workspaces"
          title="Back to workspaces"
        >
          <img
            src="/icon.svg"
            alt="OwnLab"
            className="size-5"
          />
        </Link>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={onToggleToolPanel}
          aria-label={toolPanelOpen ? 'Collapse tool panel' : 'Expand tool panel'}
          title={toolPanelOpen ? 'Collapse tool panel' : 'Expand tool panel'}
        >
          <PanelLeft className="size-4" />
        </Button>
      </div>

      <div className="flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:bg-transparent hover:text-foreground"
          onClick={onToggleChannel}
          aria-label={channelOpen ? 'Collapse channel panel' : 'Expand channel panel'}
          title={channelOpen ? 'Collapse channel panel' : 'Expand channel panel'}
        >
          <PanelRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function WorkspacePanels({
  workspaceId,
  items,
  workspaces,
  children,
}: {
  workspaceId: string;
  items: Item[];
  workspaces: WorkspaceForSwitcher[];
  children: React.ReactNode;
}) {
  const {
    selectedFilePath,
    selectedTaskId,
    setSelectedFilePath,
    setSelectedTaskId,
    setActiveToolTab,
    channelOpen,
    setChannelOpen,
  } = useWorkspaceView(workspaceId);
  const [toolPanelOpen, setToolPanelOpen] = useState(true);
  const workspace = workspaces.find((entry) => entry.id === workspaceId);

  function handleFileSelect(path: string | null) {
    setSelectedFilePath(path);
  }

  function handleTaskSelect(taskId: string | null) {
    setSelectedTaskId(taskId);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <WorkspaceTopBar
        toolPanelOpen={toolPanelOpen}
        onToggleToolPanel={() => setToolPanelOpen((current) => !current)}
        channelOpen={channelOpen}
        onToggleChannel={() => setChannelOpen(!channelOpen)}
      />

      <ResizablePanelGroup
        id="workspace-panels"
        direction="horizontal"
        className="h-full flex-1 gap-1 px-2 pb-2 pt-1"
      >
        {toolPanelOpen ? (
          <>
            <ResizablePanel
              id="workspace-panels-tools"
              order={1}
              defaultSize={22}
              minSize={18}
              maxSize={36}
              className="h-full min-h-0 min-w-0 overflow-hidden"
            >
              <ToolPanel
                items={items}
                workspaces={workspaces}
                onFileSelect={handleFileSelect}
                onTaskSelect={handleTaskSelect}
              />
            </ResizablePanel>
            <ResizableHandle
              id="workspace-panels-handle-tools"
              className="group w-1.5 shrink-0 cursor-col-resize rounded-full bg-transparent transition-colors hover:bg-white/20 data-[resize-handle-active]:bg-white/25"
            />
          </>
        ) : null}
        <ResizablePanel
          id="workspace-panels-viewboard"
          order={toolPanelOpen ? 2 : 1}
          defaultSize={channelOpen ? 54 : 78}
          minSize={36}
          className="h-full min-h-0 min-w-0 overflow-hidden"
        >
          <div className={CARD_CLASS}>
            <Viewboard
              workspaceId={workspaceId}
              workspaceName={workspace?.name}
              selectedFilePath={selectedFilePath}
              selectedTaskId={selectedTaskId}
              onCloseTask={() => setSelectedTaskId(null)}
              onOpenFiles={() => setActiveToolTab('file')}
              onOpenTasks={() => setActiveToolTab('tasks')}
              onOpenGoal={() => setActiveToolTab('goal')}
            />
          </div>
        </ResizablePanel>

        {channelOpen ? (
          <>
            <ResizableHandle
              id="workspace-panels-handle-channel"
              className="group w-1.5 shrink-0 cursor-col-resize rounded-full bg-transparent transition-colors hover:bg-white/20 data-[resize-handle-active]:bg-white/25"
            />
            <ResizablePanel
              id="workspace-panels-channel"
              order={toolPanelOpen ? 3 : 2}
              defaultSize={24}
              minSize={18}
              maxSize={34}
              className="h-full min-h-0 min-w-0 overflow-hidden"
            >
              <div className={CARD_CLASS}>
                <div className="flex min-h-0 flex-1 flex-col">{children}</div>
              </div>
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>
    </div>
  );
}

export function WorkspaceContainer({
  workspaceId,
  items,
  workspaces,
  children,
}: WorkspaceContainerProps) {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-sidebar">
      <WorkspacePanels workspaceId={workspaceId} items={items} workspaces={workspaces}>
        {children}
      </WorkspacePanels>
    </div>
  );
}
