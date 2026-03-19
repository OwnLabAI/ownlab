'use client';

import { startTransition, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Grid2x2,
  List,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchAgents,
  fetchAgentSkills,
  fetchSkillDetail,
  fetchSkills,
  updateAgentSkills,
  type AgentRecord,
  type AgentSkillAssignmentRecord,
  type SkillDetailRecord,
  type SkillRecord,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { SkillCardGrid, SkillCardList, getSkillSection, type SectionTab } from './skill-card';

const PAGE_SIZE = 15;
type ViewMode = 'grid' | 'list';
const SECTION_TABS = ['Research'] as const;
type AgentAssignmentsMap = Record<string, AgentSkillAssignmentRecord[]>;

export function SkillsPage() {
  const [skills, setSkills] = useState<SkillRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SectionTab>('Research');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [currentPage, setCurrentPage] = useState(1);

  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillDetailRecord | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [installSkillId, setInstallSkillId] = useState<string | null>(null);
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentAssignments, setAgentAssignments] = useState<AgentAssignmentsMap>({});
  const [installingAgentId, setInstallingAgentId] = useState<string | null>(null);

  const loadSkills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchSkills();
      setSkills(rows);
    } catch (err: any) {
      setError(err.message || 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSkills();
  }, [loadSkills]);

  useEffect(() => {
    if (!selectedSkillId) {
      setSelectedSkill(null);
      return;
    }

    const skillId = selectedSkillId;
    let cancelled = false;

    async function loadDetail() {
      setLoadingDetail(true);
      try {
        const row = await fetchSkillDetail(skillId);
        if (!cancelled) setSelectedSkill(row);
      } catch {
        if (!cancelled) setSelectedSkill(null);
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [selectedSkillId]);

  useEffect(() => {
    if (!installSkillId) return;

    let cancelled = false;
    async function loadAgentsState() {
      setLoadingAgents(true);
      try {
        const rows = await fetchAgents();
        if (cancelled) return;
        setAgents(rows);

        const assignments = await Promise.all(
          rows.map(async (agent) => [agent.id, await fetchAgentSkills(agent.id).catch(() => [])] as const),
        );

        if (!cancelled) setAgentAssignments(Object.fromEntries(assignments));
      } catch {
        if (!cancelled) {
          setAgents([]);
          setAgentAssignments({});
          toast.error('Failed to load agents');
        }
      } finally {
        if (!cancelled) setLoadingAgents(false);
      }
    }

    void loadAgentsState();
    return () => {
      cancelled = true;
    };
  }, [installSkillId]);

  const filteredSkills = useMemo(() => {
    return [...skills]
      .filter((skill) => getSkillSection(skill) === activeTab)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }, [activeTab, skills]);

  const totalPages = Math.max(1, Math.ceil(filteredSkills.length / PAGE_SIZE));
  const pageSkills = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredSkills.slice(start, start + PAGE_SIZE);
  }, [currentPage, filteredSkills]);

  useEffect(() => {
    startTransition(() => {
      setCurrentPage((page) => Math.min(page, totalPages));
    });
  }, [totalPages]);

  const selectedInstallSkill = useMemo(
    () => skills.find((skill) => skill.id === installSkillId) ?? selectedSkill ?? null,
    [installSkillId, selectedSkill, skills],
  );

  const handleInstall = useCallback(
    async (agent: AgentRecord) => {
      const skill = selectedInstallSkill;
      if (!skill) return;

      const currentAssignments = agentAssignments[agent.id] ?? [];
      if (currentAssignments.some((a) => a.skillId === skill.id || a.skill.slug === skill.slug)) {
        toast.success(`${skill.name} is already installed on ${agent.name}`);
        return;
      }

      setInstallingAgentId(agent.id);
      try {
        const nextAssignments = currentAssignments.map((a) => ({
          skillId: a.skillId,
          enabled: a.enabled,
          priority: a.priority,
          config: a.config,
        }));

        nextAssignments.push({
          skillId: skill.id,
          enabled: true,
          priority: currentAssignments.reduce((max, a) => Math.max(max, a.priority), 100) + 10,
          config: {},
        });

        const updated = await updateAgentSkills(agent.id, nextAssignments);
        setAgentAssignments((prev) => ({ ...prev, [agent.id]: updated }));
        toast.success(`Installed ${skill.name} to ${agent.name}`);
      } catch (err: any) {
        toast.error(err.message || 'Failed to install skill');
      } finally {
        setInstallingAgentId(null);
      }
    },
    [agentAssignments, selectedInstallSkill],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto bg-background">
      <div className="flex w-full flex-1 flex-col px-5 py-4">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-4">
          <div className="flex flex-wrap items-center gap-1">
            {SECTION_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  startTransition(() => setCurrentPage(1));
                }}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                  tab === activeTab
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5">
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn('rounded-md', viewMode === 'grid' && 'bg-background shadow-sm')}
                onClick={() => setViewMode('grid')}
              >
                <Grid2x2 className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className={cn('rounded-md', viewMode === 'list' && 'bg-background shadow-sm')}
                onClick={() => setViewMode('list')}
              >
                <List className="size-4" />
              </Button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-3xl border border-destructive/20 bg-destructive/5 px-6 py-8 text-sm text-destructive">
            {error}
          </div>
        ) : filteredSkills.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 px-6 py-12 text-center text-sm text-muted-foreground">
            No skills found.
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {pageSkills.map((skill) => (
              <SkillCardGrid
                key={skill.id}
                skill={skill}
                onPreview={setSelectedSkillId}
                onInstall={setInstallSkillId}
              />
            ))}
          </div>
        ) : (
          <div className="grid gap-2">
            {pageSkills.map((skill) => (
              <SkillCardList
                key={skill.id}
                skill={skill}
                onPreview={setSelectedSkillId}
                onInstall={setInstallSkillId}
              />
            ))}
          </div>
        )}

        {!loading && !error && filteredSkills.length > 0 ? (
          <div className="mt-6 flex items-center justify-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-lg"
              disabled={currentPage <= 1}
              onClick={() => startTransition(() => setCurrentPage((page) => Math.max(1, page - 1)))}
            >
              <ChevronLeft className="size-4" />
            </Button>

            {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? 'default' : 'ghost'}
                size="icon-sm"
                className={cn(
                  'size-8 rounded-lg text-sm',
                  page === currentPage
                    ? 'bg-foreground text-background hover:bg-foreground/90'
                    : 'text-muted-foreground',
                )}
                onClick={() => startTransition(() => setCurrentPage(page))}
              >
                {page}
              </Button>
            ))}

            <Button
              variant="ghost"
              size="icon-sm"
              className="size-8 rounded-lg"
              disabled={currentPage >= totalPages}
              onClick={() => startTransition(() => setCurrentPage((page) => Math.min(totalPages, page + 1)))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(selectedSkillId)} onOpenChange={(open) => !open && setSelectedSkillId(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden p-0">
          <DialogHeader className="flex flex-row items-start gap-3 border-b px-5 py-4 text-left">
            <Avatar size="lg">
              <AvatarFallback className="bg-muted text-xs font-semibold text-muted-foreground">
                {selectedSkill?.name?.slice(0, 2).toUpperCase() ?? '??'}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base">{selectedSkill?.name ?? 'Skill detail'}</DialogTitle>
              <DialogDescription className="mt-1 text-xs">
                {selectedSkill?.description || selectedSkill?.slug || 'Inspect the instruction content for this skill.'}
              </DialogDescription>
            </div>
            {selectedSkillId && (
              <Button
                size="sm"
                className="shrink-0 rounded-full bg-foreground text-background hover:bg-foreground/90"
                onClick={() => {
                  setInstallSkillId(selectedSkillId);
                  setSelectedSkillId(null);
                }}
              >
                <Download className="size-4" />
                Install
              </Button>
            )}
          </DialogHeader>
          <ScrollArea className="max-h-[calc(85vh-80px)]">
            <div className="px-5 py-4">
              {loadingDetail ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <pre className="whitespace-pre-wrap rounded-xl border border-border/60 bg-muted/30 p-4 text-xs leading-6 text-foreground">
                  {selectedSkill?.content || 'No skill content found.'}
                </pre>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(installSkillId)} onOpenChange={(open) => !open && setInstallSkillId(null)}>
        <DialogContent className="max-h-[80vh] overflow-hidden p-0 sm:max-w-xl">
          <DialogHeader className="border-b px-4 py-3 text-left">
            <DialogTitle className="text-base">Install {selectedInstallSkill?.name ?? 'skill'}</DialogTitle>
            <DialogDescription className="text-xs">
              Choose an existing agent. OwnLab will assign the skill and sync it into that agent runtime.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[calc(80vh-72px)]">
            <div className="grid gap-2 px-4 py-3">
              {loadingAgents ? (
                <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading...
                </div>
              ) : agents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">
                  No agents have been created yet.
                </div>
              ) : (
                agents.map((agent) => {
                  const installed = (agentAssignments[agent.id] ?? []).some(
                    (a) => a.skillId === selectedInstallSkill?.id || a.skill.slug === selectedInstallSkill?.slug,
                  );

                  return (
                    <div
                      key={agent.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card px-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{agent.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {agent.adapterType} · {agent.status}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={installed ? 'secondary' : 'default'}
                        disabled={installed || installingAgentId === agent.id}
                        onClick={() => void handleInstall(agent)}
                      >
                        {installingAgentId === agent.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : installed ? (
                          'Installed'
                        ) : (
                          'Install'
                        )}
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
