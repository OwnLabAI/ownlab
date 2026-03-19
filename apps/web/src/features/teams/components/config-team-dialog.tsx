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
import { EntityIcon } from '@/components/entity-icon';
import { updateTeam, fetchWorkspaces, type TeamRecord, type Workspace } from '@/lib/api';
import { TEAM_AVATAR_PRESETS, createAvatarOptions } from '@/lib/dicebear';
import { Loader2, Shuffle } from 'lucide-react';
import { cn } from '@/lib/utils';

type TeamConfigInput = {
  id: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  status?: string | null;
  workspaceId?: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: TeamConfigInput;
  onSaved?: (team: TeamRecord) => void;
};

function randomTeamName() {
  return `team-${Math.random().toString(36).slice(2, 7)}`;
}

function randomAvatarSeed() {
  return Math.random().toString(36).slice(2, 10);
}

export function ConfigTeamDialog({ open, onOpenChange, team, onSaved }: Props) {
  const [name, setName] = useState(team.name);
  const [description, setDescription] = useState(team.description ?? '');
  const [status, setStatus] = useState(team.status ?? 'active');
  const [selectedAvatarPreset, setSelectedAvatarPreset] = useState(TEAM_AVATAR_PRESETS[0]?.id ?? 'shapes');
  const [avatarSeedNonce, setAvatarSeedNonce] = useState(() => randomAvatarSeed());
  const [avatarDirty, setAvatarDirty] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(team.workspaceId ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const avatarOptions = useMemo(
    () => createAvatarOptions(`team-${avatarSeedNonce}`, TEAM_AVATAR_PRESETS),
    [avatarSeedNonce],
  );
  const selectedAvatarIcon = useMemo(
    () => avatarOptions.find((option) => option.id === selectedAvatarPreset)?.uri ?? avatarOptions[0]?.uri ?? null,
    [avatarOptions, selectedAvatarPreset],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function loadWorkspaces() {
      try {
        const rows = await fetchWorkspaces();
        if (cancelled) return;
        setWorkspaces(rows);
      } catch {
        if (cancelled) return;
        setWorkspaces([]);
      }
    }

    void loadWorkspaces();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || !team) return;
    setName(team.name);
    setDescription(team.description ?? '');
    setStatus(team.status ?? 'active');
    setSelectedWorkspaceId(team.workspaceId ?? '');
    setAvatarSeedNonce(randomAvatarSeed());
    setSelectedAvatarPreset(TEAM_AVATAR_PRESETS[0]?.id ?? 'shapes');
    setAvatarDirty(false);
    setError(null);
  }, [open, team]);

  const handleRefreshAvatar = useCallback(() => {
    setAvatarDirty(true);
    setAvatarSeedNonce(randomAvatarSeed());
  }, []);

  const handleSave = useCallback(async () => {
    setError(null);

    if (!name || name.length < 3) {
      setError('Team name must be at least 3 characters');
      return;
    }
    if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(name)) {
      setError('Team name must start with a letter and contain only letters, numbers, and hyphens');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateTeam(team.id, {
        name: name.trim(),
        description: description.trim() || null,
        icon: avatarDirty ? selectedAvatarIcon ?? null : team.icon ?? null,
        status: status.trim() || 'active',
        workspaceId: selectedWorkspaceId || null,
      });
      onSaved?.(updated);
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update team');
    } finally {
      setSaving(false);
    }
  }, [
    team.id,
    name,
    description,
    avatarDirty,
    status,
    selectedAvatarIcon,
    selectedWorkspaceId,
    onSaved,
    onOpenChange,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] flex flex-col overflow-hidden p-0 sm:max-w-[480px]">
        <DialogHeader className="shrink-0 px-6 pt-6 pb-2">
          <DialogTitle className="text-xl">Configure Team</DialogTitle>
          <DialogDescription>
            Update team name, description, avatar, status, and workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-2">
          <div className="space-y-6 py-2">
            <Field>
              <FieldLabel htmlFor="config-team-name">Team name</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="config-team-name"
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
              <FieldLabel htmlFor="config-team-description">Description</FieldLabel>
              <Textarea
                id="config-team-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What this team is responsible for"
                rows={3}
              />
            </Field>

            <Field>
              <FieldLabel>Avatar</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
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

            <Field>
              <FieldLabel htmlFor="config-team-status">Status</FieldLabel>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="config-team-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="idle">Idle</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="config-team-workspace">Workspace</FieldLabel>
              <Select
                value={selectedWorkspaceId || 'none'}
                onValueChange={(value) => setSelectedWorkspaceId(value === 'none' ? '' : value)}
              >
                <SelectTrigger id="config-team-workspace">
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
                Attach a workspace to enable the team channel and group chat.
              </FieldDescription>
            </Field>

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
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
            {saving ? 'Saving' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
