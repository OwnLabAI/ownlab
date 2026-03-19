'use client';

import type { ComponentType } from 'react';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Bot,
  ClipboardList,
  FolderGit2,
  LibraryBig,
  Loader2,
  Search,
} from 'lucide-react';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';

type SearchAgentResult = {
  id: string;
  name: string;
  icon: string | null;
  status: string;
};

type SearchWorkspaceResult = {
  id: string;
  name: string;
  description: string | null;
  worktreePath: string | null;
  status: string;
};

type SearchTaskResult = {
  id: string;
  title: string;
  identifier: string | null;
  objective: string | null;
  description: string | null;
  status: string;
  boardId: string | null;
  boardName: string | null;
};

type SearchResponse = {
  query: string;
  agents: SearchAgentResult[];
  workspaces: SearchWorkspaceResult[];
  tasks: SearchTaskResult[];
};

type SearchResultGroup = {
  label: string;
  items: Array<{
    id: string;
    title: string;
    subtitle?: string;
    icon: ComponentType<{ className?: string }>;
    iconClassName?: string;
    onSelect: () => void;
  }>;
};

const MAX_RESULTS_PER_GROUP = 6;

function matchesQuery(value: string, query: string) {
  return value.toLowerCase().includes(query);
}

async function searchLab(
  query: string,
  opts?: { limit?: number; signal?: AbortSignal },
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query });
  if (opts?.limit) params.set('limit', String(opts.limit));
  const res = await fetch(`/api/search?${params.toString()}`, {
    signal: opts?.signal,
  });
  if (!res.ok) throw new Error('Failed to search');
  return res.json();
}

function SearchDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLowerCase();
  const [agents, setAgents] = useState<SearchAgentResult[]>([]);
  const [workspaces, setWorkspaces] = useState<SearchWorkspaceResult[]>([]);
  const [tasks, setTasks] = useState<SearchTaskResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!normalizedQuery) {
      setAgents([]);
      setWorkspaces([]);
      setTasks([]);
      setLoadingSearch(false);
      return;
    }

    const controller = new AbortController();

    async function runSearch() {
      setLoadingSearch(true);
      try {
        const results = await searchLab(normalizedQuery, {
          limit: 8,
          signal: controller.signal,
        });
        setAgents(results.agents);
        setWorkspaces(results.workspaces);
        setTasks(results.tasks);
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error('Failed to search lab:', error);
        setAgents([]);
        setWorkspaces([]);
        setTasks([]);
      } finally {
        if (!controller.signal.aborted) setLoadingSearch(false);
      }
    }

    void runSearch();

    return () => {
      controller.abort();
    };
  }, [normalizedQuery, open]);

  const resultGroups = useMemo<SearchResultGroup[]>(() => {
    if (!normalizedQuery) return [];

    const agentItems = agents
      .filter((agent) => matchesQuery(agent.name, normalizedQuery))
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map((agent) => ({
        id: agent.id,
        title: agent.name,
        subtitle: 'Agent',
        icon: Bot,
        iconClassName: 'text-muted-foreground',
        onSelect: () => {
          setOpen(false);
          setQuery('');
          router.push(`/lab/agents/${agent.name}`);
        },
      }));

    const taskItems = tasks
      .filter(
        (task) =>
          task.boardId !== null &&
          matchesQuery([task.title, task.identifier, task.objective, task.description, task.boardName]
            .filter(Boolean)
            .join(' '), normalizedQuery),
      )
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map((task) => ({
        id: task.id,
        title: task.title,
        subtitle: task.boardName ?? undefined,
        icon: ClipboardList,
        iconClassName: 'text-blue-500',
        onSelect: () => {
          setOpen(false);
          setQuery('');
          router.push(`/lab/tasks/${task.boardId}?task_id=${task.id}`);
        },
      }));

    const workspaceItems = workspaces
      .filter((workspace) =>
        matchesQuery(
          [workspace.name, workspace.description ?? ''].join(' '),
          normalizedQuery,
        ),
      )
      .slice(0, MAX_RESULTS_PER_GROUP)
      .map((workspace) => ({
        id: workspace.id,
        title: workspace.name,
        icon: FolderGit2,
        iconClassName: 'text-amber-500',
        onSelect: () => {
          setOpen(false);
          setQuery('');
          router.push(`/lab/workspace/${workspace.id}`);
        },
      }));

    return [
      { label: 'Agents', items: agentItems },
      { label: 'Tasks', items: taskItems },
      { label: 'Workspaces', items: workspaceItems },
    ].filter((group) => group.items.length > 0);
  }, [agents, normalizedQuery, router, tasks, workspaces]);

  const isLoading = loadingSearch;

  return (
    <>
      <SidebarMenuItem>
        <SidebarMenuButton
          onClick={() => setOpen(true)}
          tooltip="Search"
          className="pl-3"
        >
          <Search className="size-4" />
          <span>Search</span>
        </SidebarMenuButton>
      </SidebarMenuItem>

      <CommandDialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setQuery('');
        }}
        title="Search"
        description="Search agents, tasks, and workspaces"
        className="sm:max-w-2xl"
      >
        <Command shouldFilter={false} className="bg-background">
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search agents, tasks, workspaces..."
            className="py-3"
          />
          <CommandList className="max-h-[26rem]">
            {!normalizedQuery ? (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Type to search across agents, tasks, and workspaces.
              </div>
            ) : isLoading ? (
              <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                <span>Searching…</span>
              </div>
            ) : resultGroups.length === 0 ? (
              <CommandEmpty>No matching agents, tasks, or workspaces.</CommandEmpty>
            ) : (
              resultGroups.map((group) => (
                <CommandGroup key={group.label} heading={group.label}>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <CommandItem
                        key={item.id}
                        value={`${group.label} ${item.title} ${item.subtitle ?? ''}`}
                        onSelect={item.onSelect}
                        className="py-2"
                      >
                        <Icon className={`size-4 ${item.iconClassName ?? ''}`} />
                        <div className="min-w-0">
                          <div className="truncate font-medium">{item.title}</div>
                          {item.subtitle ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {item.subtitle}
                            </div>
                          ) : null}
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))
            )}
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}

export function LabToolbar() {
  const pathname = usePathname();

  return (
    <div className="group-data-[collapsible=icon]:hidden">
      <SidebarGroup className="px-2 pt-0 pb-0 pl-1">
        <SidebarMenu>
          <SearchDialog />
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={pathname === '/lab/skills'}
              tooltip="Skills"
              className="pl-3"
            >
              <Link href="/lab/skills">
                <LibraryBig className="size-4" />
                <span>Skills</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>
    </div>
  );
}
