'use client';

import { FolderOpen, ListTodo, MessagesSquare, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function WorkspaceDefaultView({
  workspaceName,
  onOpenFiles,
  onOpenTasks,
  onOpenGoal,
  onOpenPlugins: _onOpenPlugins,
}: {
  workspaceName?: string;
  onOpenFiles?: () => void;
  onOpenTasks?: () => void;
  onOpenGoal?: () => void;
  onOpenPlugins?: () => void;
}) {
  return (
    <div className="flex h-full flex-1 items-center justify-center">
      <div className="mx-auto flex w-full max-w-xl flex-col items-center px-8 py-10 text-center">
        <>
          <img
            src="/logo-name.svg"
            alt="OwnLab"
            className="mx-auto mb-6 h-12 w-auto opacity-90 dark:hidden"
          />
          <img
            src="/logo-name-dark.svg"
            alt="OwnLab"
            className="mx-auto mb-6 hidden h-12 w-auto opacity-90 dark:block"
          />
        </>
        <h1 className="mb-2 text-xl font-semibold text-foreground">
          {workspaceName?.trim() || 'Workspace'}
        </h1>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          Open a file or task from the left to focus your work here. Keep chat on the right only when you need coordination.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" variant="outline" className="rounded-full" onClick={onOpenFiles}>
            <FolderOpen className="size-4" />
            Files
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={onOpenTasks}>
            <ListTodo className="size-4" />
            Tasks
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={onOpenGoal}>
            <Target className="size-4" />
            Goal
          </Button>
        </div>

        <div className="mt-8 grid w-full gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
            <FolderOpen className="size-4 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">Files</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Preview documents and code in the main workspace area.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
            <MessagesSquare className="size-4 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">Testing Notice</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Plugins are still in testing.
            </p>
          </div>
          <div className="rounded-2xl border border-border/60 bg-card/80 px-4 py-4 text-left shadow-[0_8px_24px_rgba(15,23,42,0.04)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.28)]">
            <ListTodo className="size-4 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium text-foreground">Tasks</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Review commitments here without leaving the workspace.
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <MessagesSquare className="size-4" />
          <span>Keep the shell simple while plugins are still in testing.</span>
        </div>
      </div>
    </div>
  );
}
