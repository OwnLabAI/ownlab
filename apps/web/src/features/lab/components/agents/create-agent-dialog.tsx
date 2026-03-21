'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EntityIcon } from '@/components/entity-icon';
import { AGENT_AVATAR_PRESETS, createAvatarOptions } from '@/lib/dicebear';
import { cn } from '@/lib/utils';
import {
  createAgent,
  fetchAgents,
  updateAgent,
  fetchAgencyTemplates,
  fetchWorkspaces,
  type AgencyTemplateSummary,
  type Workspace,
} from '@/lib/api';
import {
  AGENT_ADAPTER_GRID,
  getModelsForAdapter,
} from './constants';
import { CreateWorkspaceDialog } from '../workspaces/create-workspace-dialog';
import { Shuffle, CheckIcon, Loader2 } from 'lucide-react';
import { AdapterIcon } from './adapter-icon';

const RANDOM_NAMES = [
  'vera', 'nova', 'aria', 'luna', 'zara', 'milo', 'hugo', 'felix',
  'oscar', 'ruby', 'sage', 'iris', 'atlas', 'ember', 'pixel', 'drift',
];

const AGENCY_DEPARTMENTS = [
  'Engineering',
  'Design',
  'Marketing',
  'Sales',
  'Support',
  'Content',
  'Data',
  'Research',
  'Operations',
  'Other',
] as const;

const DEPARTMENT_DESCRIPTIONS: Record<(typeof AGENCY_DEPARTMENTS)[number], string> = {
  Engineering: 'Code, systems, architecture',
  Design: 'UI/UX, layouts, visual design',
  Marketing: 'Strategy, campaigns, growth',
  Sales: 'Outreach, proposals, pipeline',
  Support: 'Customer service, triage',
  Content: 'Writing, copywriting, editing',
  Data: 'Analysis, visualization, insights',
  Research: 'Information gathering, deep dives',
  Operations: 'Processes, automation, workflows',
  Other: 'Custom department',
};

function randomName() {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
}

function randomAvatarSeed() {
  return Math.random().toString(36).slice(2, 10);
}

type EnvStatus = 'idle' | 'pass' | 'warn' | 'fail';

type AgentRecord = {
  id: string;
  labId: string;
  name: string;
  role?: string | null;
  reportsTo?: string | null;
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  runtimeConfig?: Record<string, unknown>;
  icon: string | null;
  status: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (agent: AgentRecord) => void;
  onSaved?: (agent: AgentRecord) => void;
  agent?: AgentRecord | null;
};

type AgencyTemplateConfig = {
  slug: string;
  name: string;
  department: string;
  path: string;
};

type AgentWorkspaceSource = 'agent_home' | 'workspace';

function parseString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function currentAdapterConfigValue(adapterConfig: Record<string, unknown>, key: string): string {
  return typeof adapterConfig[key] === 'string' ? String(adapterConfig[key]) : '';
}

function parseAgencyTemplate(value: unknown): AgencyTemplateConfig | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const slug = parseString(record.slug);
  const name = parseString(record.name);
  const department = parseString(record.department);
  const path = parseString(record.path);
  if (!slug || !name) return null;
  return { slug, name, department, path };
}

export function CreateAgentDialog({
  open,
  onOpenChange,
  onCreated,
  onSaved,
  agent = null,
}: Props) {
  const isEditMode = Boolean(agent);
  const [adapterType, setAdapterType] = useState('codex_local');
  const [selectedAvatarPreset, setSelectedAvatarPreset] = useState(AGENT_AVATAR_PRESETS[0]?.id ?? 'fun-emoji');
  const [avatarSeedNonce, setAvatarSeedNonce] = useState(() => randomAvatarSeed());
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [model, setModel] = useState('gpt-5.4');
  const [name, setName] = useState(() => randomName());
  const [role, setRole] = useState('general');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingEnv, setTestingEnv] = useState(false);
  const [envStatus, setEnvStatus] = useState<EnvStatus>('idle');
  const [templates, setTemplates] = useState<AgencyTemplateSummary[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesLoaded, setTemplatesLoaded] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('Engineering');
  const [selectedAgencySlug, setSelectedAgencySlug] = useState<string | null>(null);
  const [selectedAgencyTemplate, setSelectedAgencyTemplate] = useState<AgencyTemplateConfig | null>(null);
  const [agencyInstructions, setAgencyInstructions] = useState('');
  const [customAgencyInstructions, setCustomAgencyInstructions] = useState('');
  const [workspaceSource, setWorkspaceSource] = useState<AgentWorkspaceSource>('agent_home');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
  const [workspaceDialogOpen, setWorkspaceDialogOpen] = useState(false);
  const [labAgents, setLabAgents] = useState<AgentRecord[]>([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');

  const modelOptions = useMemo(() => getModelsForAdapter(adapterType), [adapterType]);
  const avatarOptions = useMemo(
    () => createAvatarOptions(`agent-${avatarSeedNonce}`, AGENT_AVATAR_PRESETS),
    [avatarSeedNonce],
  );
  const selectedAvatarIcon = useMemo(
    () => avatarOptions.find((option) => option.id === selectedAvatarPreset)?.uri ?? avatarOptions[0]?.uri ?? null,
    [avatarOptions, selectedAvatarPreset],
  );
  const managerOptions = useMemo(
    () => labAgents.filter((candidate) => candidate.id !== agent?.id),
    [agent?.id, labAgents],
  );

  useEffect(() => {
    if (!open) return;

    const runtimeConfig = (agent?.runtimeConfig ?? {}) as Record<string, unknown>;
    const adapterConfig = (agent?.adapterConfig ?? {}) as Record<string, unknown>;
    const agencyTemplate = parseAgencyTemplate(runtimeConfig.agencyTemplate);
    setAdapterType(agent?.adapterType ?? 'codex_local');
    setModel(parseString(adapterConfig.model, getModelsForAdapter(agent?.adapterType ?? 'codex_local')[0]?.id ?? ''));
    setName(agent?.name ?? randomName());
    setRole(parseString(agent?.role, 'general'));
    setSelectedAvatarPreset(AGENT_AVATAR_PRESETS[0]?.id ?? 'fun-emoji');
    setAvatarSeedNonce(randomAvatarSeed());
    setAvatarDirty(false);
    setEnvStatus('idle');
    setError(null);
    setTemplatesError(null);
    setSelectedAgencySlug(agencyTemplate?.slug ?? null);
    setSelectedAgencyTemplate(agencyTemplate);
    setAgencyInstructions(parseString(runtimeConfig.agencyInstructions));
    setCustomAgencyInstructions(parseString(runtimeConfig.customAgencyInstructions));
    setSelectedDepartment(agencyTemplate?.department || 'Engineering');
    setWorkspaceSource(parseString(runtimeConfig.workspaceId) ? 'workspace' : 'agent_home');
    setSelectedWorkspaceId(parseString(runtimeConfig.workspaceId));
    setSelectedManagerId(parseString(agent?.reportsTo));
  }, [agent, open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadLabAgents() {
      try {
        const rows = await fetchAgents();
        if (!cancelled) setLabAgents(rows);
      } catch {
        if (!cancelled) setLabAgents([]);
      }
    }

    void loadLabAgents();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadWorkspaces() {
      setLoadingWorkspaces(true);
      try {
        const data = await fetchWorkspaces(agent?.labId ? { labId: agent.labId } : undefined);
        if (!cancelled) setWorkspaces(data);
      } catch {
        if (!cancelled) setWorkspaces([]);
      } finally {
        if (!cancelled) setLoadingWorkspaces(false);
      }
    }

    void loadWorkspaces();
    return () => {
      cancelled = true;
    };
  }, [agent?.labId, open]);

  useEffect(() => {
    if (!open || templatesLoaded) return;
    let cancelled = false;

    async function loadTemplates() {
      setLoadingTemplates(true);
      setTemplatesError(null);
      try {
        const data = await fetchAgencyTemplates();
        if (!cancelled) {
          setTemplates(data);
          setTemplatesLoaded(true);
        }
      } catch {
        if (!cancelled) {
          setTemplates([]);
          setTemplatesLoaded(true);
          setTemplatesError('Failed to load agency templates');
        }
      } finally {
        if (!cancelled) setLoadingTemplates(false);
      }
    }

    loadTemplates();
    return () => {
      cancelled = true;
    };
  }, [open, templatesLoaded]);

  const handleRetryTemplates = useCallback(() => {
    setTemplatesLoaded(false);
  }, []);

  const templatesForDepartment = useMemo(
    () => templates.filter((template) => template.department === selectedDepartment),
    [selectedDepartment, templates],
  );

  const handleAdapterChange = useCallback((key: string) => {
    const opt = AGENT_ADAPTER_GRID.find((a) => a.key === key);
    if (opt?.comingSoon) return;
    setAdapterType(key);
    const models = getModelsForAdapter(key);
    setModel(models[0]?.id ?? '');
    setEnvStatus('idle');
  }, []);

  const handleSelectAgency = useCallback((template: AgencyTemplateSummary) => {
    setSelectedDepartment(template.department);
    setSelectedAgencySlug(template.slug);
    setSelectedAgencyTemplate({
      slug: template.slug,
      name: template.name,
      department: template.department,
      path: template.path,
    });
    setAgencyInstructions('');
  }, []);

  const handleTestEnvironment = useCallback(async () => {
    setEnvStatus('idle');
    setTestingEnv(true);
    try {
      const res = await fetch(`/api/agents/adapters/${encodeURIComponent(adapterType)}/test-environment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adapterConfig: {
            model,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEnvStatus('fail');
        return;
      }
      if (data && typeof data.status === 'string') {
        setEnvStatus(data.status as EnvStatus);
      }
    } catch {
      setEnvStatus('fail');
    } finally {
      setTestingEnv(false);
    }
  }, [adapterType, model]);

  const handleWorkspaceCreated = useCallback(
    async (workspaceId: string) => {
      setWorkspaceDialogOpen(false);
      try {
        const data = await fetchWorkspaces(agent?.labId ? { labId: agent.labId } : undefined);
        setWorkspaces(data);
        setWorkspaceSource('workspace');
        setSelectedWorkspaceId(workspaceId);
      } catch {
        setError('Workspace was created, but the list could not be refreshed');
      }
    },
    [agent?.labId],
  );

  const handleRefreshAvatar = useCallback(() => {
    setAvatarDirty(true);
    setAvatarSeedNonce(randomAvatarSeed());
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);
    if (!name || name.length < 3) {
      setError('Name must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(name)) {
      setError('Must start with a letter and contain only letters, numbers, and hyphens');
      return;
    }
    if (workspaceSource === 'workspace' && !selectedWorkspaceId) {
      setError('Select a workspace or switch back to the agent home directory');
      return;
    }

    const currentAgent = agent;
    const currentAdapterConfig = (currentAgent?.adapterConfig ?? {}) as Record<string, unknown>;
    const currentRuntimeConfig = (currentAgent?.runtimeConfig ?? {}) as Record<string, unknown>;
    const icon = isEditMode && !avatarDirty ? currentAgent?.icon ?? null : selectedAvatarIcon;

    setSaving(true);
    try {
      const payload = {
        name,
        role,
        reportsTo: selectedManagerId || null,
        adapterType,
        icon,
        adapterConfig: {
          ...currentAdapterConfig,
          model,
          promptTemplate: '{{context.prompt}}',
          ...(adapterType === 'codex_local'
            ? { dangerouslyBypassApprovalsAndSandbox: true }
            : {}),
        },
        runtimeConfig: {
          ...currentRuntimeConfig,
          agencyTemplate: selectedAgencyTemplate,
          agencyInstructions: agencyInstructions.trim() || null,
          customAgencyInstructions: customAgencyInstructions.trim() || null,
          workspaceId: workspaceSource === 'workspace' ? selectedWorkspaceId : null,
        },
      };

      if (currentAgent?.id) {
        const updated = await updateAgent(currentAgent.id, payload);
        onSaved?.(updated);
      } else {
        const created = await createAgent({
          name,
          role,
          reportsTo: selectedManagerId || null,
          adapterType,
          model,
          icon,
          agentType: 'local',
          adapterConfig: payload.adapterConfig,
          runtimeConfig: payload.runtimeConfig,
        });
        onCreated?.(created);
      }
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || `Failed to ${isEditMode ? 'update' : 'create'} agent`);
    } finally {
      setSaving(false);
    }
  }, [
    adapterType,
    agencyInstructions,
    agent,
    customAgencyInstructions,
    avatarDirty,
    isEditMode,
    model,
    name,
    role,
    onCreated,
    onOpenChange,
    onSaved,
    selectedAgencyTemplate,
    selectedAvatarIcon,
    selectedManagerId,
    selectedWorkspaceId,
    workspaceSource,
  ]);

  const cardBgClass = useMemo(() => {
    if (envStatus === 'pass') return 'bg-green-500/10 border-green-500/30';
    if (envStatus === 'fail') return 'bg-red-500/10 border-red-500/30';
    if (envStatus === 'warn') return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-muted/50 border-border';
  }, [envStatus]);

  const requiresEnvironmentTest = !isEditMode;
  const hasEnvironmentClearance = envStatus === 'pass' || envStatus === 'warn';
  const showExtendedConfig = !requiresEnvironmentTest || hasEnvironmentClearance;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] flex flex-col p-0 sm:max-w-[640px]">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="text-xl">{isEditMode ? 'Agent Config' : 'New Agent'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update runtime settings, agency instructions, and model behavior.'
              : 'Choose a runtime, assign an agency profile, and give your agent a name.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-2 min-h-0">
          <div className="space-y-6 py-2">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Agent type</Label>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
                {AGENT_ADAPTER_GRID.map((opt) => {
                  const isSelected = adapterType === opt.key;
                  return (
                    <button
                      key={opt.key}
                      type="button"
                      disabled={opt.comingSoon}
                      onClick={() => handleAdapterChange(opt.key)}
                      className={cn(
                        'relative flex min-h-[72px] flex-col items-start justify-start gap-1.5 rounded-xl border p-3 text-left transition-colors',
                        opt.comingSoon && 'opacity-50 cursor-not-allowed',
                        isSelected ? cardBgClass : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30',
                      )}
                    >
                      <AdapterIcon adapterKey={opt.key} />
                      <span className="font-semibold text-sm">{opt.label}</span>
                      {isSelected && <CheckIcon className="absolute top-3 right-3 size-4 text-primary" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {modelOptions.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">Environment</Label>
                <p className="text-xs text-muted-foreground">
                  {requiresEnvironmentTest
                    ? 'Run a quick check first. Continue once the selected runtime passes or returns non-blocking warnings.'
                    : 'This agent is already configured. Re-run the check only if you want to verify the current runtime again.'}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestEnvironment}
                  disabled={testingEnv}
                >
                  {testingEnv && <Loader2 className="mr-2 size-4 animate-spin" />}
                  {requiresEnvironmentTest ? 'Test environment' : 'Re-test environment'}
                </Button>
                {requiresEnvironmentTest && !hasEnvironmentClearance && (
                  <p className="text-xs text-muted-foreground">
                    A passing check or warning result will unlock the remaining agent settings.
                  </p>
                )}
              </div>

              {showExtendedConfig ? (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Name</Label>
                    <div className="flex gap-2">
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="agent-name"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setName(randomName())}
                        title="Random name"
                      >
                        <Shuffle className="size-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      3-30 letters, numbers, and hyphens. Must start with a letter.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Avatar</Label>
                    <div className="flex gap-2 flex-wrap items-center">
                      {avatarOptions.map((avatar) => (
                        <button
                          key={avatar.id}
                          type="button"
                          onClick={() => {
                            setAvatarDirty(true);
                            setSelectedAvatarPreset(avatar.id);
                          }}
                          className={cn(
                            'flex size-14 items-center justify-center rounded-2xl border-2 p-1 transition-colors',
                            selectedAvatarPreset === avatar.id
                              ? 'border-primary bg-primary/10'
                              : 'border-transparent bg-muted hover:bg-muted/80',
                          )}
                          aria-label={`Use ${avatar.label} avatar`}
                          title={avatar.label}
                        >
                          <EntityIcon
                            icon={avatar.uri}
                            name={avatar.label}
                            className="size-full rounded-xl"
                            fallbackClassName="rounded-xl"
                          />
                        </button>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleRefreshAvatar}
                        aria-label="Refresh avatars"
                        title="Refresh avatars"
                        className="size-14 rounded-2xl"
                      >
                        <Shuffle className="size-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Agency</Label>
                      <p className="text-xs text-muted-foreground">
                        Pick a reusable role template from `agency/templates` and install it as the
                        agent&apos;s local profile bundle.
                      </p>
                    </div>

                    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
                      {AGENCY_DEPARTMENTS.map((department) => {
                        const isSelected = selectedDepartment === department;
                        const count = templates.filter((template) => template.department === department).length;
                        return (
                          <button
                            key={department}
                            type="button"
                            onClick={() => setSelectedDepartment(department)}
                            className={cn(
                              'rounded-2xl border px-4 py-3 text-left transition-colors',
                              isSelected
                                ? 'border-primary/40 bg-primary/5'
                                : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30',
                            )}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-semibold">{department}</span>
                              <Badge variant="secondary">{count}</Badge>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {DEPARTMENT_DESCRIPTIONS[department]}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div className="rounded-2xl border bg-muted/20">
                      <ScrollArea className="h-56">
                        <div className="grid gap-2 p-3 md:grid-cols-2">
                          {loadingTemplates && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Loader2 className="size-4 animate-spin" />
                              Loading agency templates...
                            </div>
                          )}
                          {!loadingTemplates && templatesError && (
                            <div className="flex items-center justify-between gap-3 rounded-xl border border-dashed px-3 py-3">
                              <p className="text-sm text-muted-foreground">{templatesError}</p>
                              <Button type="button" variant="outline" size="sm" onClick={handleRetryTemplates}>
                                Retry
                              </Button>
                            </div>
                          )}
                          {!loadingTemplates && !templatesError && templatesForDepartment.length === 0 && (
                            <p className="text-sm text-muted-foreground">
                              No built-in templates in this department yet. You can still add custom instructions below.
                            </p>
                          )}
                          {templatesForDepartment.map((template) => {
                            const isSelected = selectedAgencySlug === template.slug;
                            return (
                              <button
                                key={template.slug}
                                type="button"
                                onClick={() => handleSelectAgency(template)}
                                className={cn(
                                  'rounded-xl border px-3 py-3 text-left transition-colors',
                                  isSelected
                                    ? 'border-primary/40 bg-primary/5'
                                    : 'border-border bg-background hover:border-muted-foreground/30',
                                )}
                              >
                                <div className="flex items-center gap-2">
                                  <span>{template.emoji ?? '📄'}</span>
                                  <span className="font-medium">{template.name}</span>
                                </div>
                                {template.description && (
                                  <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
                                )}
                                {template.vibe && (
                                  <p className="mt-2 text-xs text-muted-foreground">{template.vibe}</p>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Additional custom instructions</Label>
                      <Textarea
                        value={customAgencyInstructions}
                        onChange={(e) => setCustomAgencyInstructions(e.target.value)}
                        placeholder="Add lab-specific constraints, tone, goals, or collaboration rules..."
                        className="min-h-28"
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Workspace</Label>
                      <p className="text-xs text-muted-foreground">
                        Choose where this agent should work by default. You can keep it in its own home
                        directory or attach it to an existing shared workspace.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => setWorkspaceSource('agent_home')}
                        className={cn(
                          'min-h-[112px] max-w-[360px] flex-1 basis-[280px] rounded-2xl border px-4 py-3 text-left transition-colors',
                          workspaceSource === 'agent_home'
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30',
                        )}
                      >
                        <div className="font-semibold">Use agent home directory</div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Recommended for quick setup. The agent works directly from its private home directory.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWorkspaceSource('workspace')}
                        className={cn(
                          'min-h-[112px] max-w-[360px] flex-1 basis-[280px] rounded-2xl border px-4 py-3 text-left transition-colors',
                          workspaceSource === 'workspace'
                            ? 'border-primary/40 bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30',
                        )}
                      >
                        <div className="font-semibold">Attach existing workspace</div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Use a shared lab workspace so the agent starts with the right project context.
                        </p>
                      </button>
                    </div>

                    {workspaceSource === 'workspace' && (
                      <div className="space-y-3 rounded-2xl border px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">Shared workspace</p>
                            <p className="text-xs text-muted-foreground">
                              Select an existing workspace or create one before saving.
                            </p>
                          </div>
                          <Button type="button" variant="outline" size="sm" onClick={() => setWorkspaceDialogOpen(true)}>
                            New workspace
                          </Button>
                        </div>

                        <Select
                          value={selectedWorkspaceId || 'none'}
                          onValueChange={(value) => setSelectedWorkspaceId(value === 'none' ? '' : value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={loadingWorkspaces ? 'Loading workspaces...' : 'Select a workspace'} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Select a workspace</SelectItem>
                            {workspaces.map((workspace) => (
                              <SelectItem key={workspace.id} value={workspace.id}>
                                {workspace.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Role</Label>
                    <Input
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="general"
                    />
                    <p className="text-xs text-muted-foreground">
                      A short role label that will be injected into the agent runtime and shown in channel rosters.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Manager agent</Label>
                    <Select
                      value={selectedManagerId || 'none'}
                      onValueChange={(value) => setSelectedManagerId(value === 'none' ? '' : value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="No manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No manager</SelectItem>
                        {managerOptions.map((candidate) => (
                          <SelectItem key={candidate.id} value={candidate.id}>
                            {candidate.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Use this to build an agent hierarchy. Child agents can report to another agent in the same lab.
                    </p>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                  Remaining agent settings will appear here after the environment check passes or returns warnings.
                </div>
              )}
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 mx-0 mb-0 rounded-b-xl">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={
              saving ||
              (requiresEnvironmentTest && !hasEnvironmentClearance)
            }
          >
            {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEditMode ? 'Save changes' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
      <CreateWorkspaceDialog
        open={workspaceDialogOpen}
        onOpenChange={setWorkspaceDialogOpen}
        onCreated={handleWorkspaceCreated}
      />
    </Dialog>
  );
}
