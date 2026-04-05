'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Field,
  FieldDescription,
  FieldLabel,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { EntityIcon } from '@/components/entity-icon';
import {
  buildOwnlabApiUrl,
  createTeam,
  fetchWorkspaces,
  type TeamRecord,
  type Workspace,
} from '@/lib/api';
import { TEAM_AVATAR_PRESETS, createAvatarOptions } from '@/lib/dicebear';
import {
  AGENT_ADAPTER_GRID,
  getModelsForAdapter,
} from '../agents/constants';
import { CheckIcon, Loader2, Shuffle, Users } from 'lucide-react';
import { AdapterIcon } from '../agents/adapter-icon';
import { cn } from '@/lib/utils';

type EnvStatus = 'idle' | 'pass' | 'warn' | 'fail';

type TeamCreationResult = {
  team: TeamRecord;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (result: TeamCreationResult) => void;
};

const WORKER_COUNT_MIN = 0;
const WORKER_COUNT_MAX = 12;

function randomTeamName() {
  return `team-${Math.random().toString(36).slice(2, 7)}`;
}

function randomLeaderName() {
  return `lead-${Math.random().toString(36).slice(2, 7)}`;
}

function randomAvatarSeed() {
  return Math.random().toString(36).slice(2, 10);
}

export function CreateTeamDialog({ open, onOpenChange, onCreated }: Props) {
  const [name, setName] = useState(() => randomTeamName());
  const [description, setDescription] = useState('');
  const [leaderName, setLeaderName] = useState(() => randomLeaderName());
  const [leaderRole, setLeaderRole] = useState('leader');
  const [workerCount, setWorkerCount] = useState(4);
  const [workerRole, setWorkerRole] = useState('worker');
  const [workerNamePrefix, setWorkerNamePrefix] = useState('worker');
  const [adapterType, setAdapterType] = useState('codex_local');
  const [model, setModel] = useState('gpt-5.4');
  const [selectedAvatarPreset, setSelectedAvatarPreset] = useState(TEAM_AVATAR_PRESETS[0]?.id ?? 'shapes');
  const [avatarSeedNonce, setAvatarSeedNonce] = useState(() => randomAvatarSeed());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testingEnv, setTestingEnv] = useState(false);
  const [envStatus, setEnvStatus] = useState<EnvStatus>('idle');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');

  const modelOptions = useMemo(() => getModelsForAdapter(adapterType), [adapterType]);
  const [avatarOptions, setAvatarOptions] = useState<Array<(typeof TEAM_AVATAR_PRESETS)[number] & { uri: string }>>([]);
  const selectedAvatarIcon = useMemo(
    () => avatarOptions.find((option) => option.id === selectedAvatarPreset)?.uri ?? avatarOptions[0]?.uri ?? null,
    [avatarOptions, selectedAvatarPreset],
  );

  useEffect(() => {
    let cancelled = false;

    createAvatarOptions(`team-${avatarSeedNonce}`, TEAM_AVATAR_PRESETS)
      .then((options) => {
        if (!cancelled) {
          setAvatarOptions(options);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvatarOptions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [avatarSeedNonce]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadWorkspaces() {
      try {
        const rows = await fetchWorkspaces();
        if (cancelled) return;
        setWorkspaces(rows);
        setSelectedWorkspaceId((current) => current || rows[0]?.id || '');
      } catch {
        if (cancelled) return;
        setWorkspaces([]);
        setSelectedWorkspaceId('');
      }
    }

    void loadWorkspaces();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setModel(getModelsForAdapter(adapterType)[0]?.id ?? '');
  }, [adapterType, open]);

  useEffect(() => {
    if (!open) return;
    setAvatarSeedNonce(randomAvatarSeed());
    setSelectedAvatarPreset(TEAM_AVATAR_PRESETS[0]?.id ?? 'shapes');
  }, [open]);

  const handleAdapterChange = useCallback((nextAdapterType: string) => {
    const option = AGENT_ADAPTER_GRID.find((item) => item.key === nextAdapterType);
    if (option?.comingSoon) {
      return;
    }
    setAdapterType(nextAdapterType);
    setEnvStatus('idle');
  }, []);

  const handleRefreshAvatar = useCallback(() => {
    setAvatarSeedNonce(randomAvatarSeed());
  }, []);

  const handleTestEnvironment = useCallback(async () => {
    setTestingEnv(true);
    setEnvStatus('idle');
    try {
      const res = await fetch(buildOwnlabApiUrl(`/api/agents/adapters/${encodeURIComponent(adapterType)}/test-environment`), {
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
      setEnvStatus(typeof data.status === 'string' ? (data.status as EnvStatus) : 'pass');
    } catch {
      setEnvStatus('fail');
    } finally {
      setTestingEnv(false);
    }
  }, [adapterType, model]);

  const handleSave = useCallback(async () => {
    setError(null);

    if (!name || name.length < 3) {
      setError('Team name must be at least 3 characters');
      return;
    }
    if (!leaderName || leaderName.length < 3) {
      setError('Leader name must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(name)) {
      setError('Team name must start with a letter and contain only letters, numbers, and hyphens');
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(leaderName)) {
      setError('Leader name must start with a letter and contain only letters, numbers, and hyphens');
      return;
    }
    if (workerCount < WORKER_COUNT_MIN || workerCount > WORKER_COUNT_MAX) {
      setError(`Worker count must be between ${WORKER_COUNT_MIN} and ${WORKER_COUNT_MAX}`);
      return;
    }

    setSaving(true);
    try {
      const result = await createTeam({
        name,
        description: description.trim() || undefined,
        leaderName,
        leaderRole: leaderRole.trim() || 'leader',
        workerCount,
        workerRole: workerRole.trim() || 'worker',
        workerNamePrefix: workerNamePrefix.trim() || undefined,
        workspaceId: selectedWorkspaceId || undefined,
        adapterType,
        model,
        icon: selectedAvatarIcon ?? undefined,
        runtimeConfig: {
          workspaceId: selectedWorkspaceId || null,
        },
      });
      onCreated?.({ team: result.team });
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to create team');
    } finally {
      setSaving(false);
    }
  }, [
    adapterType,
    description,
    leaderName,
    leaderRole,
    model,
    name,
    onCreated,
    onOpenChange,
    selectedAvatarIcon,
    selectedWorkspaceId,
    workerCount,
    workerNamePrefix,
    workerRole,
  ]);

  const environmentReady = envStatus === 'pass' || envStatus === 'warn';

  const cardBgClass = useMemo(() => {
    if (envStatus === 'pass') return 'bg-green-500/10 border-green-500/30';
    if (envStatus === 'fail') return 'bg-red-500/10 border-red-500/30';
    if (envStatus === 'warn') return 'bg-amber-500/10 border-amber-500/30';
    return 'bg-muted/50 border-border';
  }, [envStatus]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] flex flex-col overflow-hidden p-0 sm:max-w-[640px]">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
          <DialogTitle className="text-xl">New Team</DialogTitle>
          <DialogDescription>
            Create one leader and a batch of workers that share the same runtime and collaborate in a team channel.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2">
          <div className="space-y-6 py-2">
            <Field>
              <FieldLabel>Runtime</FieldLabel>
              <FieldDescription>
                All members in this team will use the same adapter and model.
              </FieldDescription>
              <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(140px,1fr))]">
                {AGENT_ADAPTER_GRID.map((option) => {
                  const isSelected = adapterType === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      disabled={option.comingSoon}
                      onClick={() => handleAdapterChange(option.key)}
                      className={cn(
                        'relative flex min-h-[72px] flex-col items-start justify-start gap-1.5 rounded-xl border p-3 text-left transition-colors',
                        option.comingSoon && 'cursor-not-allowed opacity-50',
                        isSelected ? cardBgClass : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30',
                      )}
                    >
                      <AdapterIcon adapterKey={option.key} />
                      <span className="font-semibold text-sm">{option.label}</span>
                      {isSelected ? <CheckIcon className="absolute top-3 right-3 size-4 text-primary" /> : null}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field>
              <FieldLabel htmlFor="team-model">Model</FieldLabel>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger id="team-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {modelOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Environment</FieldLabel>
              <FieldDescription>
                Run a quick check first. Team details unlock after the selected runtime passes or returns non-blocking warnings.
              </FieldDescription>
              <div className="flex items-center gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestEnvironment}
                  disabled={testingEnv}
                >
                  {testingEnv ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                  {testingEnv ? 'Testing' : 'Test environment'}
                </Button>
                {envStatus !== 'idle' ? (
                  <Badge variant={envStatus === 'fail' ? 'destructive' : 'secondary'}>
                    {envStatus}
                  </Badge>
                ) : null}
              </div>
              {!environmentReady && (
                <FieldDescription className="pt-1">
                  A passing check or warning result will unlock workspace, team name, and worker settings.
                </FieldDescription>
              )}
            </Field>

            {environmentReady ? (
              <>
                <Field>
                  <FieldLabel htmlFor="team-workspace">Workspace</FieldLabel>
                  <Select
                    value={selectedWorkspaceId || 'none'}
                    onValueChange={(value) => setSelectedWorkspaceId(value === 'none' ? '' : value)}
                  >
                    <SelectTrigger id="team-workspace">
                      <SelectValue placeholder="No workspace yet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="none">No workspace yet</SelectItem>
                        {workspaces.map((workspace) => (
                          <SelectItem key={workspace.id} value={workspace.id}>
                            {workspace.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    Optional. If you attach a workspace, this team's agents will automatically appear in that workspace's members and the team chat will use a shared workspace channel.
                  </FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="team-name">Team name</FieldLabel>
                  <div className="flex gap-2">
                    <Input
                      id="team-name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="research-squad"
                      aria-invalid={Boolean(error) && name.length < 3}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setName(randomTeamName())}
                      title="Random name"
                    >
                      <Shuffle className="size-4" />
                    </Button>
                  </div>
                </Field>

                <Field>
                  <FieldLabel htmlFor="team-description">Description</FieldLabel>
                  <Textarea
                    id="team-description"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="What this team is responsible for"
                    rows={3}
                  />
                </Field>

                <Field>
                  <FieldLabel>Avatar</FieldLabel>
                  <div className="flex flex-wrap gap-2 items-center">
                    {avatarOptions.map((avatar) => (
                      <button
                        key={avatar.id}
                        type="button"
                        onClick={() => setSelectedAvatarPreset(avatar.id)}
                        className={cn(
                          'flex size-14 items-center justify-center rounded-2xl border-2 p-1 transition-colors',
                          selectedAvatarPreset === avatar.id
                            ? 'border-primary bg-primary/10'
                            : 'border-transparent bg-muted hover:bg-muted/80',
                        )}
                        aria-label={`Use ${avatar.label} as team avatar`}
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
                </Field>

                <div className="grid gap-4 md:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="team-leader-name">Leader name</FieldLabel>
                    <Input
                      id="team-leader-name"
                      value={leaderName}
                      onChange={(event) => setLeaderName(event.target.value)}
                      placeholder="research-lead"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="team-leader-role">Leader role</FieldLabel>
                    <Input
                      id="team-leader-role"
                      value={leaderRole}
                      onChange={(event) => setLeaderRole(event.target.value)}
                      placeholder="leader"
                    />
                  </Field>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <Field>
                    <FieldLabel htmlFor="team-worker-count">Worker count</FieldLabel>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{workerCount}</span>
                      </div>
                      <Slider
                        id="team-worker-count"
                        value={[workerCount]}
                        onValueChange={([v]) => setWorkerCount(v ?? WORKER_COUNT_MIN)}
                        min={WORKER_COUNT_MIN}
                        max={WORKER_COUNT_MAX}
                        step={1}
                      />
                    </div>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="team-worker-role">Worker role</FieldLabel>
                    <Input
                      id="team-worker-role"
                      value={workerRole}
                      onChange={(event) => setWorkerRole(event.target.value)}
                      placeholder="worker"
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="team-worker-prefix">Worker prefix</FieldLabel>
                    <Input
                      id="team-worker-prefix"
                      value={workerNamePrefix}
                      onChange={(event) => setWorkerNamePrefix(event.target.value)}
                      placeholder="research-worker"
                    />
                  </Field>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                Remaining team settings will appear here after the environment check passes or returns warnings.
              </div>
            )}

            {error ? (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="mx-0 mb-0 shrink-0 rounded-b-xl border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={() => void handleSave()} disabled={saving || !environmentReady}>
            {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {saving ? 'Creating team' : 'Create team'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
