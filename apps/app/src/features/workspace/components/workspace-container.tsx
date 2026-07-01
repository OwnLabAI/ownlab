'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { PanelLeft, PanelRight } from 'lucide-react';
import { toast } from 'sonner';
import { updateWorkspaceFileContent } from '@/lib/api';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ToolPanel } from './tool-panel';
import { Viewboard } from './viewboard';
import { ViewboardTabs } from './viewboard/viewboard-tabs';
import { useWorkspaceView } from '@/features/workspace/stores/use-workspace-view-store';
import type { Item } from '@/features/workspace/data/items';
import type { WorkspaceForSwitcher } from '@/features/lab/data/workspaces';

interface WorkspaceContainerProps {
  workspaceId: string;
  items: Item[];
  workspaces: WorkspaceForSwitcher[];
  children: React.ReactNode;
}

type FileSession = {
  draft: string;
  savedContent: string;
};

function getFileName(path: string) {
  return path.split('/').pop() ?? path;
}

const CARD_CLASS =
  'flex h-full min-h-0 w-full max-w-full flex-col overflow-hidden rounded-[20px] border border-border/60 bg-card shadow-none';

function WorkspaceTopBar({
  toolPanelOpen,
  onToggleToolPanel,
  channelOpen,
  onToggleChannel,
  openFilePaths,
  activeFilePath,
  dirtyFilePaths,
  onSelectFilePath,
  onCloseFilePath,
  tabLeft,
  tabRight,
  leftControlsRef,
  rightControlsRef,
}: {
  toolPanelOpen: boolean;
  onToggleToolPanel: () => void;
  channelOpen: boolean;
  onToggleChannel: () => void;
  openFilePaths: string[];
  activeFilePath: string | null;
  dirtyFilePaths: string[];
  onSelectFilePath: (path: string) => void;
  onCloseFilePath: (path: string) => void;
  tabLeft: number;
  tabRight: number;
  leftControlsRef: RefObject<HTMLDivElement | null>;
  rightControlsRef: RefObject<HTMLDivElement | null>;
}) {
  const tabWidth = Math.max(0, tabRight - tabLeft);

  return (
    <div className="desktop-macos-workspace-topbar desktop-window-drag relative flex h-10 min-h-10 shrink-0 items-center justify-between px-2">
      <div
        ref={leftControlsRef}
        className="desktop-window-no-drag relative z-10 flex shrink-0 items-center gap-2"
      >
        <Link
          href="/lab/workspaces"
          className="desktop-window-no-drag flex size-8 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent/40 hover:text-foreground"
          aria-label="Back to workspaces"
          title="Back to workspaces"
        >
          <>
            <img
              src="/icon.svg"
              alt="OwnLab"
              className="size-5 dark:hidden"
            />
            <img
              src="/icon-dark.svg"
              alt="OwnLab"
              className="hidden size-5 dark:block"
            />
          </>
        </Link>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="desktop-window-no-drag size-8 rounded-lg text-muted-foreground hover:bg-accent/40 hover:text-foreground"
          onClick={onToggleToolPanel}
          aria-label={toolPanelOpen ? 'Collapse tool panel' : 'Expand tool panel'}
          title={toolPanelOpen ? 'Collapse tool panel' : 'Expand tool panel'}
        >
          <PanelLeft className="size-4" />
        </Button>
      </div>

      {tabWidth > 0 ? (
        <div
          className="pointer-events-none desktop-window-drag absolute inset-y-0 z-0"
          style={{ left: tabLeft, width: tabWidth }}
        >
          <div className="pointer-events-auto flex h-full items-center overflow-hidden px-2">
            <ViewboardTabs
              openFilePaths={openFilePaths}
              activeFilePath={activeFilePath}
              dirtyFilePaths={dirtyFilePaths}
              onSelect={onSelectFilePath}
              onClose={onCloseFilePath}
              className="min-w-0 flex-1"
              listClassName="h-full w-full justify-start gap-1.5"
              tabClassName="h-8 max-w-[13rem] rounded-xl px-3"
            />
          </div>
        </div>
      ) : null}

      <div
        ref={rightControlsRef}
        className="desktop-window-no-drag relative z-10 flex shrink-0 items-center"
      >
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="desktop-window-no-drag size-8 rounded-lg text-muted-foreground hover:bg-accent/40 hover:text-foreground"
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
    openFilePaths,
    selectedSourceId,
    selectedTaskId,
    setSelectedFilePath,
    closeFileTab,
    setSelectedSourceId,
    setSelectedTaskId,
    setActiveToolTab,
    channelOpen,
    setChannelOpen,
  } = useWorkspaceView(workspaceId);
  const [toolPanelOpen, setToolPanelOpen] = useState(true);
  const [fileSessions, setFileSessions] = useState<Record<string, FileSession>>({});
  const fileSessionsRef = useRef<Record<string, FileSession>>({});
  const [pendingClosePath, setPendingClosePath] = useState<string | null>(null);
  const [isResolvingClose, setIsResolvingClose] = useState(false);
  const topBarRef = useRef<HTMLDivElement | null>(null);
  const leftControlsRef = useRef<HTMLDivElement | null>(null);
  const rightControlsRef = useRef<HTMLDivElement | null>(null);
  const scrollHideTimersRef = useRef(new Map<HTMLElement, number>());
  const [tabFrame, setTabFrame] = useState({ left: 0, right: 0 });
  const workspace = workspaces.find((entry) => entry.id === workspaceId);

  useEffect(() => {
    fileSessionsRef.current = fileSessions;
  }, [fileSessions]);

  useEffect(() => {
    setFileSessions({});
    fileSessionsRef.current = {};
    setPendingClosePath(null);
    setIsResolvingClose(false);
  }, [workspaceId]);

  const syncFileSession = useCallback((path: string, content: string) => {
    setFileSessions((current) => {
      const existing = current[path];
      if (!existing) {
        return {
          ...current,
          [path]: {
            draft: content,
            savedContent: content,
          },
        };
      }

      if (existing.draft !== existing.savedContent) {
        return current;
      }

      if (existing.savedContent === content && existing.draft === content) {
        return current;
      }

      return {
        ...current,
        [path]: {
          draft: content,
          savedContent: content,
        },
      };
    });
  }, []);

  const updateFileDraft = useCallback((path: string, draft: string, savedContent?: string) => {
    setFileSessions((current) => {
      const existing = current[path];
      const baseSavedContent = existing?.savedContent ?? savedContent ?? '';
      if (existing && existing.draft === draft) {
        return current;
      }

      return {
        ...current,
        [path]: {
          draft,
          savedContent: baseSavedContent,
        },
      };
    });
  }, []);

  const markFileSaved = useCallback((path: string, content: string) => {
    setFileSessions((current) => ({
      ...current,
      [path]: {
        draft: content,
        savedContent: content,
      },
    }));
  }, []);

  const discardFileDraft = useCallback((path: string) => {
    setFileSessions((current) => {
      const existing = current[path];
      if (!existing || existing.draft === existing.savedContent) {
        return current;
      }

      return {
        ...current,
        [path]: {
          ...existing,
          draft: existing.savedContent,
        },
      };
    });
  }, []);

  const isFileDirty = useCallback(
    (path: string) => {
      const session = fileSessionsRef.current[path];
      return !!session && session.draft !== session.savedContent;
    },
    [],
  );

  const saveFileDraft = useCallback(async (path: string) => {
    const session = fileSessionsRef.current[path];
    if (!session || session.draft === session.savedContent) {
      return;
    }

    await updateWorkspaceFileContent(workspaceId, path, session.draft);
    markFileSaved(path, session.draft);
  }, [markFileSaved, workspaceId]);

  const closeFileImmediately = useCallback((path: string) => {
    closeFileTab(path);
  }, [closeFileTab]);

  const requestCloseFile = useCallback((path: string) => {
    if (isFileDirty(path)) {
      setPendingClosePath(path);
      return;
    }

    closeFileImmediately(path);
  }, [closeFileImmediately, isFileDirty]);

  const dirtyFilePaths = openFilePaths.filter((path) => isFileDirty(path));

  function handleFileSelect(path: string | null) {
    setSelectedFilePath(path);
  }

  const handleInvalidFilePath = useCallback((path: string) => {
    closeFileImmediately(path);
    toast.info('Folders cannot be opened in the viewboard.');
  }, [closeFileImmediately]);

  function handleTaskSelect(taskId: string | null) {
    setSelectedTaskId(taskId);
  }

  useEffect(() => {
    const topBarElement = topBarRef.current;
    const viewboardElement = document.getElementById('workspace-panels-viewboard');
    if (!topBarElement || !viewboardElement) {
      return;
    }

    const updateTabFrame = () => {
      const topBarRect = topBarElement.getBoundingClientRect();
      const viewboardRect = viewboardElement.getBoundingClientRect();
      const leftControlsRect = leftControlsRef.current?.getBoundingClientRect();
      const rightControlsRect = rightControlsRef.current?.getBoundingClientRect();
      const viewboardLeft = Math.max(0, viewboardRect.left - topBarRect.left);
      const viewboardRight = Math.min(topBarRect.width, viewboardRect.right - topBarRect.left);
      const safeLeft = leftControlsRect
        ? Math.max(0, leftControlsRect.right - topBarRect.left + 8)
        : 0;
      const safeRight = rightControlsRect
        ? Math.min(topBarRect.width, rightControlsRect.left - topBarRect.left - 8)
        : topBarRect.width;
      const left = Math.max(viewboardLeft, safeLeft);
      const right = Math.max(left, Math.min(viewboardRight, safeRight));

      setTabFrame({
        left,
        right,
      });
    };

    updateTabFrame();

    const resizeObserver = new ResizeObserver(() => updateTabFrame());
    resizeObserver.observe(topBarElement);
    resizeObserver.observe(viewboardElement);
    if (leftControlsRef.current) {
      resizeObserver.observe(leftControlsRef.current);
    }
    if (rightControlsRef.current) {
      resizeObserver.observe(rightControlsRef.current);
    }
    window.addEventListener('resize', updateTabFrame);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateTabFrame);
    };
  }, [channelOpen, toolPanelOpen]);

  useEffect(() => {
    const ACTIVE_CLASS = 'ownlab-scroll-active';
    const HIDE_DELAY_MS = 700;

    const markScrollActive = (container: HTMLElement) => {
      container.classList.add(ACTIVE_CLASS);

      const existingTimer = scrollHideTimersRef.current.get(container);
      if (existingTimer) {
        window.clearTimeout(existingTimer);
      }

      const nextTimer = window.setTimeout(() => {
        container.classList.remove(ACTIVE_CLASS);
        scrollHideTimersRef.current.delete(container);
      }, HIDE_DELAY_MS);

      scrollHideTimersRef.current.set(container, nextTimer);
    };

    const handleScroll = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const container = target.closest('.ownlab-viewboard-scroll, .ownlab-channel-scroll');
      if (!(container instanceof HTMLElement)) {
        return;
      }

      markScrollActive(container);
    };

    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('scroll', handleScroll, true);
      for (const timer of scrollHideTimersRef.current.values()) {
        window.clearTimeout(timer);
      }
      scrollHideTimersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (dirtyFilePaths.length === 0) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [dirtyFilePaths.length]);

  return (
    <div className="flex h-full min-h-0 w-full max-w-full flex-1 flex-col overflow-hidden">
      <div ref={topBarRef} className="shrink-0">
        <WorkspaceTopBar
          toolPanelOpen={toolPanelOpen}
          onToggleToolPanel={() => setToolPanelOpen((current) => !current)}
          channelOpen={channelOpen}
          onToggleChannel={() => setChannelOpen(!channelOpen)}
          openFilePaths={openFilePaths}
          activeFilePath={selectedFilePath}
          dirtyFilePaths={dirtyFilePaths}
          onSelectFilePath={setSelectedFilePath}
          onCloseFilePath={requestCloseFile}
          tabLeft={tabFrame.left}
          tabRight={tabFrame.right}
          leftControlsRef={leftControlsRef}
          rightControlsRef={rightControlsRef}
        />
      </div>

      <ResizablePanelGroup
        id="workspace-panels"
        direction="horizontal"
        className="h-full min-w-0 max-w-full flex-1 gap-1 overflow-hidden px-2 pb-2 pt-1"
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
                onSourceSelect={setSelectedSourceId}
                onTaskSelect={handleTaskSelect}
              />
            </ResizablePanel>
            <ResizableHandle
              id="workspace-panels-handle-tools"
              className="group w-1.5 shrink-0 cursor-col-resize rounded-full bg-transparent transition-colors hover:bg-accent/70 data-[resize-handle-active]:bg-accent"
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
              openFilePaths={openFilePaths}
              selectedSourceId={selectedSourceId}
              selectedTaskId={selectedTaskId}
              fileDraftContent={selectedFilePath ? fileSessions[selectedFilePath]?.draft : undefined}
              isFileDirty={isFileDirty}
              onFileContentLoaded={syncFileSession}
              onFileDraftChange={updateFileDraft}
              onFileSaved={markFileSaved}
              onCloseSource={() => setSelectedSourceId(null)}
              onCloseTask={() => setSelectedTaskId(null)}
              onInvalidFilePath={handleInvalidFilePath}
              onOpenFiles={() => setActiveToolTab('file')}
              onOpenSources={() => setActiveToolTab('sources')}
              onOpenTasks={() => setActiveToolTab('tasks')}
              onOpenGoal={() => setActiveToolTab('goal')}
            />
          </div>
        </ResizablePanel>

        {channelOpen ? (
          <>
            <ResizableHandle
              id="workspace-panels-handle-channel"
              className="group w-1.5 shrink-0 cursor-col-resize rounded-full bg-transparent transition-colors hover:bg-accent/70 data-[resize-handle-active]:bg-accent"
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
                <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
              </div>
            </ResizablePanel>
          </>
        ) : null}
      </ResizablePanelGroup>

      <AlertDialog
        open={!!pendingClosePath}
        onOpenChange={(open) => {
          if (!open && !isResolvingClose) {
            setPendingClosePath(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-xl rounded-[1.75rem] border border-border/70 p-0 shadow-2xl">
          <AlertDialogHeader className="gap-3 border-b border-border/60 px-8 py-7 text-left">
            <AlertDialogTitle className="text-[1.05rem] font-medium leading-8 text-foreground">
              {pendingClosePath
                ? `Do you want to save the changes you made to ${getFileName(pendingClosePath)}?`
                : 'Do you want to save your changes?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[1.05rem] leading-8 text-muted-foreground">
              Your changes will be lost if you don&apos;t save them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row items-center justify-end gap-3 px-6 py-5">
            <AlertDialogCancel
              className="h-11 rounded-xl border-0 px-5 text-lg text-muted-foreground shadow-none"
              disabled={isResolvingClose}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              type="button"
              variant="ghost"
              className="h-11 rounded-xl px-5 text-lg text-foreground"
              disabled={isResolvingClose || !pendingClosePath}
              onClick={() => {
                if (!pendingClosePath) {
                  return;
                }

                discardFileDraft(pendingClosePath);
                closeFileImmediately(pendingClosePath);
                setPendingClosePath(null);
              }}
            >
              Don&apos;t Save
            </Button>
            <Button
              type="button"
              className="h-11 rounded-xl px-5 text-lg"
              disabled={isResolvingClose || !pendingClosePath}
              onClick={async () => {
                if (!pendingClosePath) {
                  return;
                }

                setIsResolvingClose(true);
                try {
                  await saveFileDraft(pendingClosePath);
                  closeFileImmediately(pendingClosePath);
                  setPendingClosePath(null);
                } catch (error) {
                  console.error('Failed to save file before closing tab:', error);
                  toast.error(error instanceof Error ? error.message : 'Failed to save file');
                } finally {
                  setIsResolvingClose(false);
                }
              }}
            >
              Save
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
    <div className="flex h-full min-h-0 w-full max-w-full overflow-hidden bg-sidebar">
      <WorkspacePanels workspaceId={workspaceId} items={items} workspaces={workspaces}>
        {children}
      </WorkspacePanels>
    </div>
  );
}
