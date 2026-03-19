'use client';

import { useState } from 'react';
import type { SkillRecord } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

export type SectionTab = 'Research';

const AVATAR_COLORS: Record<SectionTab, string> = {
  Research: 'bg-emerald-100 text-emerald-700',
};

export function getSkillCategory(skill: SkillRecord): string {
  const category = skill.metadata?.category;
  if (typeof category === 'string' && category.trim().length > 0) {
    return category.trim();
  }
  return skill.sourceType === 'builtin' ? 'OwnLab' : 'Community';
}

export function getSkillCollection(skill: SkillRecord): string | null {
  const value = skill.metadata?.collectionName;
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function getSkillSummary(skill: SkillRecord): string {
  const text = skill.description?.trim();
  if (!text) return 'Open this skill to inspect the full instructions and install it to an agent.';
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
}

export function getSkillSection(_skill: SkillRecord): SectionTab {
  return 'Research';
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

interface SkillCardProps {
  skill: SkillRecord;
  onPreview: (id: string) => void;
  onInstall: (id: string) => void;
}

export function SkillCardGrid({ skill, onPreview, onInstall }: SkillCardProps) {
  const [hovered, setHovered] = useState(false);
  const section = getSkillSection(skill);
  const colorClass = AVATAR_COLORS[section];

  return (
    <div
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card p-4 transition-shadow',
        'hover:shadow-md',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Header: avatar + name */}
      <div className="mb-3 flex items-center gap-3">
        <Avatar size="lg">
          <AvatarFallback className={cn('text-xs font-semibold', colorClass)}>
            {getInitials(skill.name)}
          </AvatarFallback>
        </Avatar>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {skill.name}
        </p>
      </div>

      {/* Description */}
      <p className="line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground">
        {getSkillSummary(skill)}
      </p>

      {/* Buttons overlay (on hover, no height change) */}
      {hovered && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-linear-to-t from-card via-card/95 to-transparent p-4 pt-8">
          <Button
            variant="outline"
            size="sm"
            className="h-8 flex-1 rounded-full text-xs font-medium"
            onClick={(e) => { e.stopPropagation(); onPreview(skill.id); }}
          >
            See more
          </Button>
          <Button
            size="sm"
            className="h-8 flex-1 rounded-full bg-foreground text-background text-xs font-medium hover:bg-foreground/90"
            onClick={(e) => { e.stopPropagation(); onInstall(skill.id); }}
          >
            Install
          </Button>
        </div>
      )}
    </div>
  );
}

export function SkillCardList({ skill, onPreview, onInstall }: SkillCardProps) {
  const [hovered, setHovered] = useState(false);
  const section = getSkillSection(skill);
  const colorClass = AVATAR_COLORS[section];

  return (
    <div
      className={cn(
        'group flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3 transition-shadow',
        'hover:shadow-md',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Avatar>
        <AvatarFallback className={cn('text-[10px] font-semibold', colorClass)}>
          {getInitials(skill.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{skill.name}</p>
        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{getSkillSummary(skill)}</p>
      </div>
      {hovered ? (
        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 rounded-full text-xs"
            onClick={(e) => { e.stopPropagation(); onPreview(skill.id); }}
          >
            See more
          </Button>
          <Button
            size="sm"
            className="h-7 rounded-full bg-foreground text-background text-xs hover:bg-foreground/90"
            onClick={(e) => { e.stopPropagation(); onInstall(skill.id); }}
          >
            Install
          </Button>
        </div>
      ) : null}
    </div>
  );
}
