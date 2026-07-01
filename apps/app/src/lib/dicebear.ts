type AvatarStyleModule = unknown;

export type AvatarPreset = {
  id: string;
  label: string;
  seedSuffix?: string;
  options?: Record<string, unknown>;
  loadStyle: () => Promise<AvatarStyleModule>;
};

const roundedOptions = {
  radius: 16,
  size: 96,
};

async function loadDicebearCore() {
  return import('@dicebear/core');
}

function loadCollectionStyle(styleName: string) {
  return async () => {
    const collection = await import('@dicebear/collection');
    return collection[styleName as keyof typeof collection];
  };
}

export const AGENT_AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'fun-emoji',
    label: 'Fun Emoji',
    loadStyle: loadCollectionStyle('funEmoji'),
    options: { ...roundedOptions, backgroundColor: ['60a5fa', '93c5fd', 'bfdbfe'] },
  },
  {
    id: 'bottts',
    label: 'Bottts',
    loadStyle: loadCollectionStyle('bottts'),
    options: { ...roundedOptions, backgroundColor: ['bbf7d0', '99f6e4', 'bfdbfe'] },
  },
  {
    id: 'adventurer',
    label: 'Adventurer',
    loadStyle: loadCollectionStyle('adventurer'),
    options: { ...roundedOptions, backgroundColor: ['fde68a', 'fbcfe8', 'fed7aa'] },
  },
  {
    id: 'lorelei',
    label: 'Lorelei',
    loadStyle: loadCollectionStyle('lorelei'),
    options: { ...roundedOptions, backgroundColor: ['e9d5ff', 'fecdd3', 'bfdbfe'] },
  },
  {
    id: 'micah',
    label: 'Micah',
    loadStyle: loadCollectionStyle('micah'),
    options: { ...roundedOptions, backgroundColor: ['d9f99d', 'bfdbfe', 'fde68a'] },
  },
  {
    id: 'open-peeps',
    label: 'Open Peeps',
    loadStyle: loadCollectionStyle('openPeeps'),
    options: { ...roundedOptions, backgroundColor: ['e2e8f0', 'dbeafe', 'dcfce7'] },
  },
];

export const TEAM_AVATAR_PRESETS: AvatarPreset[] = [
  {
    id: 'shapes',
    label: 'Shapes',
    loadStyle: loadCollectionStyle('shapes'),
    options: { ...roundedOptions, backgroundColor: ['dbeafe', 'e9d5ff', 'fce7f3'] },
  },
  {
    id: 'icons',
    label: 'Icons',
    loadStyle: loadCollectionStyle('icons'),
    options: { ...roundedOptions, backgroundColor: ['dcfce7', 'dbeafe', 'fef3c7'] },
  },
  {
    id: 'rings',
    label: 'Rings',
    loadStyle: loadCollectionStyle('rings'),
    options: { ...roundedOptions, backgroundColor: ['fde68a', 'fbcfe8', 'bfdbfe'] },
  },
  {
    id: 'thumbs',
    label: 'Thumbs',
    loadStyle: loadCollectionStyle('thumbs'),
    options: { ...roundedOptions, backgroundColor: ['bfdbfe', 'bbf7d0', 'fde68a'] },
  },
  {
    id: 'notionists',
    label: 'Notionists',
    loadStyle: loadCollectionStyle('notionists'),
    options: { ...roundedOptions, backgroundColor: ['e2e8f0', 'fecaca', 'dbeafe'] },
  },
  {
    id: 'bottts-team',
    label: 'Bottts',
    loadStyle: loadCollectionStyle('bottts'),
    seedSuffix: 'team',
    options: { ...roundedOptions, backgroundColor: ['c7d2fe', 'a7f3d0', 'fbcfe8'] },
  },
];

function normalizeSeed(seed: string) {
  return seed.trim() || 'ownlab';
}

export async function createAvatarIcon(seed: string, preset: AvatarPreset) {
  const [{ createAvatar }, style] = await Promise.all([
    loadDicebearCore(),
    preset.loadStyle(),
  ]);

  return createAvatar(style as Parameters<typeof createAvatar>[0], {
    seed: `${normalizeSeed(seed)}-${preset.seedSuffix ?? preset.id}`,
    ...preset.options,
  }).toDataUri();
}

export async function createAvatarOptions(seed: string, presets: AvatarPreset[]) {
  return Promise.all(
    presets.map(async (preset) => ({
      ...preset,
      uri: await createAvatarIcon(seed, preset),
    })),
  );
}
