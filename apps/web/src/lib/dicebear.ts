import { createAvatar } from '@dicebear/core';
import {
  adventurer,
  bottts,
  funEmoji,
  icons,
  lorelei,
  micah,
  notionists,
  openPeeps,
  rings,
  shapes,
  thumbs,
} from '@dicebear/collection';

type AvatarStyleModule = Parameters<typeof createAvatar>[0];

export type AvatarPreset = {
  id: string;
  label: string;
  style: AvatarStyleModule;
  seedSuffix?: string;
  options?: Record<string, unknown>;
};

const roundedOptions = {
  radius: 16,
  size: 96,
};

export const AGENT_AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'fun-emoji',
    label: 'Fun Emoji',
    style: funEmoji,
    options: { ...roundedOptions, backgroundColor: ['60a5fa', '93c5fd', 'bfdbfe'] },
  },
  {
    id: 'bottts',
    label: 'Bottts',
    style: bottts,
    options: { ...roundedOptions, backgroundColor: ['bbf7d0', '99f6e4', 'bfdbfe'] },
  },
  {
    id: 'adventurer',
    label: 'Adventurer',
    style: adventurer,
    options: { ...roundedOptions, backgroundColor: ['fde68a', 'fbcfe8', 'fed7aa'] },
  },
  {
    id: 'lorelei',
    label: 'Lorelei',
    style: lorelei,
    options: { ...roundedOptions, backgroundColor: ['e9d5ff', 'fecdd3', 'bfdbfe'] },
  },
  {
    id: 'micah',
    label: 'Micah',
    style: micah,
    options: { ...roundedOptions, backgroundColor: ['d9f99d', 'bfdbfe', 'fde68a'] },
  },
  {
    id: 'open-peeps',
    label: 'Open Peeps',
    style: openPeeps,
    options: { ...roundedOptions, backgroundColor: ['e2e8f0', 'dbeafe', 'dcfce7'] },
  },
];

export const TEAM_AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'shapes',
    label: 'Shapes',
    style: shapes,
    options: { ...roundedOptions, backgroundColor: ['dbeafe', 'e9d5ff', 'fce7f3'] },
  },
  {
    id: 'icons',
    label: 'Icons',
    style: icons,
    options: { ...roundedOptions, backgroundColor: ['dcfce7', 'dbeafe', 'fef3c7'] },
  },
  {
    id: 'rings',
    label: 'Rings',
    style: rings,
    options: { ...roundedOptions, backgroundColor: ['fde68a', 'fbcfe8', 'bfdbfe'] },
  },
  {
    id: 'thumbs',
    label: 'Thumbs',
    style: thumbs,
    options: { ...roundedOptions, backgroundColor: ['bfdbfe', 'bbf7d0', 'fde68a'] },
  },
  {
    id: 'notionists',
    label: 'Notionists',
    style: notionists,
    options: { ...roundedOptions, backgroundColor: ['e2e8f0', 'fecaca', 'dbeafe'] },
  },
  {
    id: 'bottts-team',
    label: 'Bottts',
    style: bottts,
    seedSuffix: 'team',
    options: { ...roundedOptions, backgroundColor: ['c7d2fe', 'a7f3d0', 'fbcfe8'] },
  },
];

function normalizeSeed(seed: string) {
  return seed.trim() || 'ownlab';
}

export function createAvatarIcon(seed: string, preset: AvatarPreset) {
  return createAvatar(preset.style, {
    seed: `${normalizeSeed(seed)}-${preset.seedSuffix ?? preset.id}`,
    ...preset.options,
  }).toDataUri();
}

export function createAvatarOptions(seed: string, presets: AvatarPreset[]) {
  return presets.map((preset) => ({
    ...preset,
    uri: createAvatarIcon(seed, preset),
  }));
}
