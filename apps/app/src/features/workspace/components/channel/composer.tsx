'use client';

import { PaperclipIcon } from 'lucide-react';
import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from '@/components/ai-elements/attachments';
import {
  PromptInputHeader,
  usePromptInputAttachments,
} from '@/components/ai-elements/prompt-input';
import { Button } from '@/components/ui/button';

export function ComposerAttachmentButton() {
  const attachments = usePromptInputAttachments();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-1.5 px-2 text-xs text-muted-foreground"
      onClick={() => attachments.openFileDialog()}
      aria-label="Attach files"
      title="Attach files"
    >
      <PaperclipIcon className="size-3.5" />
      {attachments.files.length > 0 ? <span>{attachments.files.length}</span> : null}
    </Button>
  );
}

export function ComposerAttachments() {
  const attachments = usePromptInputAttachments();

  if (attachments.files.length === 0) {
    return null;
  }

  return (
    <PromptInputHeader>
      <Attachments variant="inline" className="w-full">
        {attachments.files.map((file) => (
          <Attachment
            key={file.id}
            data={file}
            onRemove={() => attachments.remove(file.id)}
          >
            <AttachmentPreview />
            <AttachmentInfo />
            <AttachmentRemove label="Remove attachment" />
          </Attachment>
        ))}
      </Attachments>
    </PromptInputHeader>
  );
}
