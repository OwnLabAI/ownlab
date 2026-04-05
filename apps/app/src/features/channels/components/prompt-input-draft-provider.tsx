'use client';

import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import {
  PromptInputProvider,
  usePromptInputAttachments,
  usePromptInputController,
} from '@/components/ai-elements/prompt-input';
import { useChannelDraft } from '@/features/channels/stores/use-channel-draft-store';
import { useChannelAttachmentDraft } from '@/features/channels/stores/use-channel-attachment-draft-store';

type PromptInputDraftProviderProps = PropsWithChildren<{
  draftKey: string;
}>;

export function PromptInputDraftProvider({
  draftKey,
  children,
}: PromptInputDraftProviderProps) {
  const { draft } = useChannelDraft(draftKey);
  const { attachments } = useChannelAttachmentDraft(draftKey);

  return (
    <PromptInputProvider
      key={draftKey}
      initialInput={draft}
      initialAttachments={attachments}
      manageAttachmentUrlsExternally
    >
      <PromptInputDraftSync draftKey={draftKey} />
      {children}
    </PromptInputProvider>
  );
}

function PromptInputDraftSync({ draftKey }: { draftKey: string }) {
  const controller = usePromptInputController();
  const promptAttachments = usePromptInputAttachments();
  const { draft, setDraft, clearDraft } = useChannelDraft(draftKey);
  const {
    attachments,
    setAttachments,
    clearAttachments,
  } = useChannelAttachmentDraft(draftKey);
  const value = controller.textInput.value;

  useEffect(() => {
    if (value === draft) {
      return;
    }

    if (value.trim().length === 0) {
      clearDraft();
      return;
    }

    setDraft(value);
  }, [clearDraft, draft, setDraft, value]);

  useEffect(() => {
    const nextAttachments = promptAttachments.files.map((file) => ({ ...file }));
    if (sameAttachments(nextAttachments, attachments)) {
      return;
    }

    if (nextAttachments.length === 0) {
      clearAttachments();
      return;
    }

    setAttachments(nextAttachments);
  }, [attachments, clearAttachments, promptAttachments.files, setAttachments]);

  return null;
}

function sameAttachments(
  left: Array<{ id: string; url?: string; filename?: string }>,
  right: Array<{ id: string; url?: string; filename?: string }>,
) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((attachment, index) => {
    const other = right[index];
    return (
      attachment.id === other?.id &&
      attachment.url === other?.url &&
      attachment.filename === other?.filename
    );
  });
}
