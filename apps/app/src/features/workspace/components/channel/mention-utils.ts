import type { ChannelMention, WorkspaceAgent } from '@/lib/api';

export function findMentionDraft(value: string, cursor: number) {
  const beforeCaret = value.slice(0, cursor);
  const match = /(^|\s)@([^\s@]*)$/.exec(beforeCaret);
  if (!match) {
    return null;
  }

  return {
    query: match[2] ?? '',
    start: beforeCaret.length - match[2].length - 1,
    end: cursor,
  };
}

export function getMentionSuggestions(
  agents: WorkspaceAgent[],
  query: string | null,
  selectedMentions: ChannelMention[],
) {
  if (query === null) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  const selectedIds = new Set(selectedMentions.map((mention) => mention.id));

  return agents
    .filter((agent) => !selectedIds.has(agent.id))
    .filter((agent) => {
      if (!normalizedQuery) {
        return true;
      }

      return agent.name.toLowerCase().includes(normalizedQuery);
    })
    .slice(0, 8);
}

export function filterMentionsByContent(
  mentions: ChannelMention[],
  content: string,
) {
  const usageCount = new Map<string, number>();

  return mentions.filter((mention) => {
    const nextExpectedIndex = usageCount.get(mention.label) ?? 0;
    const matches = countOccurrences(content, mention.label);
    if (matches <= nextExpectedIndex) {
      return false;
    }

    usageCount.set(mention.label, nextExpectedIndex + 1);
    return true;
  });
}

export function setTextareaValue(textarea: HTMLTextAreaElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value',
  );
  descriptor?.set?.call(textarea, value);
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function countOccurrences(content: string, value: string) {
  if (!value) {
    return 0;
  }

  let count = 0;
  let searchIndex = 0;

  while (searchIndex < content.length) {
    const foundIndex = content.indexOf(value, searchIndex);
    if (foundIndex === -1) {
      break;
    }
    count += 1;
    searchIndex = foundIndex + value.length;
  }

  return count;
}
