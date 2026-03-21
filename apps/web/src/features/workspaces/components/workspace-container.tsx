'use client';

import { PanelLeft, PanelRight } from 'lucide-react';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Button } from '@/components/ui/button';
import { useSidebar } from '@/components/ui/sidebar';
import { ToolPanel } from './tool-panel';
import { Viewboard } from './viewboard';
import { useWorkspaceView } from '@/features/workspaces/stores/use-workspace-view-store';
import type { Item } from '@/features/workspaces/data/items';
import type { WorkspaceForSwitcher } from '@/features/lab/data/workspaces';

interface WorkspaceContainerProps {
  workspaceId: string;
  items: Item[];
  workspaces: WorkspaceForSwitcher[];
  children: React.ReactNode;
}

function WorkspaceTopBar({
  viewboardOpen,
  onToggleViewboard,
}: {
  viewboardOpen: boolean;
  onToggleViewboard: () => void;
}) {
  const { toggleSidebar } = useSidebar();

  return (
    <div className="flex h-12 shrink-0 items-center justify-between px-2 pt-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:bg-transparent hover:text-foreground"
        onClick={toggleSidebar}
        aria-label="Toggle lab sidebar"
        title="Toggle lab sidebar"
      >
        <PanelLeft className="size-4" />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-8 text-muted-foreground hover:bg-transparent hover:text-foreground"
        onClick={onToggleViewboard}
        aria-label={viewboardOpen ? 'Collapse viewboard panel' : 'Expand viewboard panel'}
        title={viewboardOpen ? 'Collapse viewboard panel' : 'Expand viewboard panel'}
      >
        <PanelRight className="size-4" />
      </Button>
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
  const { selectedFilePath, setSelectedFilePath, viewboardOpen, setViewboardOpen } = useWorkspaceView(workspaceId);

  function handleFileSelect(path: string | null) {
    setSelectedFilePath(path);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <WorkspaceTopBar
        viewboardOpen={viewboardOpen}
        onToggleViewboard={() => setViewboardOpen(!viewboardOpen)}
      />

      <ResizablePanelGroup
        id="workspace-panels"
        direction="horizontal"
        className="h-full flex-1 gap-0 px-2 pb-2 pt-1"
      >
        <ResizablePanel
          id="workspace-panels-tools"
          order={1}
          defaultSize={viewboardOpen ? 24 : 22}
          minSize={18}
          maxSize={36}
          className="h-full min-h-0 min-w-0 overflow-hidden"
        >
          <ToolPanel
            items={items}
            workspaces={workspaces}
            onFileSelect={handleFileSelect}
          />
        </ResizablePanel>
        <ResizableHandle
          id="workspace-panels-handle-tools"
          className="group mx-1 w-px shrink-0 cursor-col-resize bg-border/70 transition-colors hover:bg-border data-[resize-handle-active]:bg-border"
        />
        <ResizablePanel
          id="workspace-panels-channel"
          order={2}
          defaultSize={viewboardOpen ? 38 : 78}
          minSize={24}
          className="h-full min-h-0 min-w-0 overflow-hidden"
        >
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </div>
        </ResizablePanel>

        {viewboardOpen ? (
          <>
            <ResizableHandle
              id="workspace-panels-handle-viewboard"
              className="group mx-1 w-px shrink-0 cursor-col-resize bg-border/70 transition-colors hover:bg-border data-[resize-handle-active]:bg-border"
            />
            <ResizablePanel
              id="workspace-panels-viewboard"
              order={3}
              defaultSize={38}
              minSize={24}
              className="h-full min-h-0 min-w-0 overflow-hidden"
            >
              <Viewboard
                workspaceId={workspaceId}
                selectedFilePath={selectedFilePath}
              />
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
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-background">
      <WorkspacePanels workspaceId={workspaceId} items={items} workspaces={workspaces}>
        {children}
      </WorkspacePanels>
    </div>
  );
}
