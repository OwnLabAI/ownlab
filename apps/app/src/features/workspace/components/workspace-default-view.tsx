'use client';

import { BookOpenText, FolderOpen, ListTodo, MessagesSquare, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function WorkspaceDefaultView({
  workspaceName,
  onOpenFiles,
  onOpenSources,
  onOpenTasks,
  onOpenGoal,
}: {
  workspaceName?: string;
  onOpenFiles?: () => void;
  onOpenSources?: () => void;
  onOpenTasks?: () => void;
  onOpenGoal?: () => void;
}) {
  return (
    <div className="flex h-full flex-1 items-center justify-center">
      <div className="mx-auto flex w-full max-w-lg flex-col items-center px-8 py-10 text-center">
        <>
          <img
            src="/logo-name.svg"
            alt="OwnLab"
            className="mx-auto mb-5 h-10 w-auto dark:hidden"
          />
          <img
            src="/logo-name-dark.svg"
            alt="OwnLab"
            className="mx-auto mb-5 hidden h-10 w-auto dark:block"
          />
        </>
        <h1 className="mb-2 text-lg font-semibold text-foreground">
          {workspaceName?.trim() || 'Workspace'}
        </h1>
        <p className="max-w-md text-sm leading-6 text-muted-foreground">
          Open a file, source, or task from the left to start working here.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
          <Button type="button" variant="outline" className="rounded-full" onClick={onOpenFiles}>
            <FolderOpen className="size-4" />
            Files
          </Button>
          <Button type="button" variant="outline" className="rounded-full" onClick={onOpenSources}>
            <BookOpenText className="size-4" />
            Sources
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

        <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
          <MessagesSquare className="size-4" />
          <span>Open chat only when you need coordination.</span>
        </div>
      </div>
    </div>
  );
}
