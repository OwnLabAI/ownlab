'use client';

import type { FileUIPart } from 'ai';
import { create } from 'zustand';

type DraftAttachment = FileUIPart & { id: string };

type ChannelAttachmentDraftStore = {
  drafts: Record<string, DraftAttachment[]>;
  setAttachments: (draftKey: string, attachments: DraftAttachment[]) => void;
  clearAttachments: (draftKey: string) => void;
};

function revokeAttachmentUrls(attachments: DraftAttachment[]) {
  for (const attachment of attachments) {
    if (typeof attachment.url === 'string' && attachment.url.startsWith('blob:')) {
      URL.revokeObjectURL(attachment.url);
    }
  }
}

export const useChannelAttachmentDraftStore = create<ChannelAttachmentDraftStore>()((set, get) => ({
  drafts: {},
  setAttachments: (draftKey, attachments) => {
    if (!draftKey) {
      return;
    }

    const previous = get().drafts[draftKey] ?? [];
    const nextIds = new Set(attachments.map((attachment) => attachment.id));
    revokeAttachmentUrls(previous.filter((attachment) => !nextIds.has(attachment.id)));

    set((state) => ({
      drafts: attachments.length > 0
        ? {
            ...state.drafts,
            [draftKey]: attachments,
          }
        : (() => {
            const { [draftKey]: _removed, ...rest } = state.drafts;
            return rest;
          })(),
    }));
  },
  clearAttachments: (draftKey) => {
    if (!draftKey) {
      return;
    }

    const previous = get().drafts[draftKey] ?? [];
    if (previous.length === 0) {
      return;
    }

    revokeAttachmentUrls(previous);
    set((state) => {
      const { [draftKey]: _removed, ...rest } = state.drafts;
      return { drafts: rest };
    });
  },
}));

export function useChannelAttachmentDraft(draftKey: string) {
  const attachments = useChannelAttachmentDraftStore((state) => state.drafts[draftKey] ?? []);
  const setAttachments = useChannelAttachmentDraftStore((state) => state.setAttachments);
  const clearAttachments = useChannelAttachmentDraftStore((state) => state.clearAttachments);

  return {
    attachments,
    setAttachments: (nextAttachments: DraftAttachment[]) => setAttachments(draftKey, nextAttachments),
    clearAttachments: () => clearAttachments(draftKey),
  };
}
