export type ChannelAttachmentTextExtractionKind =
  | "inline_text"
  | "pdf_text"
  | "image_ocr"
  | "unsupported"
  | "failed";

export interface ChannelAttachment {
  type: "file";
  filename?: string;
  mediaType?: string;
  url?: string;
  textContent?: string | null;
  textExtractionKind?: ChannelAttachmentTextExtractionKind | null;
}

export interface ChannelMention {
  id: string;
  type: "agent";
  label: string;
}

export interface ChannelDisplayMessage {
  id: string;
  channelId: string;
  sessionId?: string | null;
  actorId: string;
  actorType: string;
  content: string;
  metadata: Record<string, unknown> | null;
  mentions: ChannelMention[];
  actorName: string | null;
  actorIcon: string | null;
  attachments: ChannelAttachment[];
  createdAt: string;
}

export interface ChannelChatExecution {
  exitCode: number | null;
  timedOut: boolean;
  errorMessage: string | null;
  usage?: Record<string, unknown> | null;
  provider?: string | null;
  model?: string | null;
}

export type ChannelChatStreamEvent =
  | {
      type: "user_message";
      message: ChannelDisplayMessage;
    }
  | {
      type: "assistant_message_start";
      message: ChannelDisplayMessage;
    }
  | {
      type: "assistant_message_content";
      messageId: string;
      content: string;
    }
  | {
      type: "assistant_message_complete";
      temporaryMessageId: string;
      message: ChannelDisplayMessage;
      execution: ChannelChatExecution;
    }
  | {
      type: "status";
      message: string;
    }
  | {
      type: "error";
      error: string;
    };
