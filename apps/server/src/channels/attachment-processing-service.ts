import { Buffer } from "node:buffer";
import { Worker } from "node:worker_threads";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type {
  ChannelAttachment,
  ChannelAttachmentTextExtractionKind,
} from "@ownlab/shared";

const MAX_ATTACHMENT_TEXT_CHARS = 12_000;
const OCR_TIMEOUT_MS = 15_000;

export type AttachmentPromptContent = {
  label: string;
  body: string | null;
};

type ParsedDataUrl = {
  mediaType: string;
  payload: string;
  isBase64: boolean;
};

export function createAttachmentProcessingService() {
  async function enrichAttachments(
    attachments: ChannelAttachment[] | undefined,
  ): Promise<ChannelAttachment[]> {
    if (!attachments || attachments.length === 0) {
      return [];
    }

    const enriched: ChannelAttachment[] = [];
    for (const attachment of attachments) {
      enriched.push(await enrichAttachment(attachment));
    }
    return enriched;
  }

  function buildPromptContents(attachments: ChannelAttachment[]): AttachmentPromptContent[] {
    return attachments.map((attachment) => ({
      label: buildAttachmentLabel(attachment),
      body: trimAttachmentText(attachment.textContent),
    }));
  }

  async function enrichAttachment(attachment: ChannelAttachment): Promise<ChannelAttachment> {
    const normalized = normalizeAttachment(attachment);
    if (normalized.textContent) {
      return {
        ...normalized,
        textContent: trimAttachmentText(normalized.textContent),
      };
    }

    const parsed = parseDataUrl(normalized.url);
    if (!parsed) {
      return {
        ...normalized,
        textExtractionKind: normalized.textExtractionKind ?? "unsupported",
      };
    }

    const mediaType = (normalized.mediaType ?? parsed.mediaType).toLowerCase();
    try {
      const data = decodeDataUrlPayload(parsed);
      if (isInlineTextMediaType(mediaType)) {
        return {
          ...normalized,
          textContent: trimAttachmentText(data.toString("utf8").replace(/\0/g, "").trim()),
          textExtractionKind: "inline_text",
        };
      }

      if (mediaType === "application/pdf") {
        return {
          ...normalized,
          textContent: await extractPdfText(data),
          textExtractionKind: "pdf_text",
        };
      }

      if (mediaType.startsWith("image/")) {
        const textContent = await extractImageText(data, mediaType);
        return {
          ...normalized,
          textContent,
          textExtractionKind: textContent ? "image_ocr" : "unsupported",
        };
      }

      return {
        ...normalized,
        textExtractionKind: "unsupported",
      };
    } catch {
      return {
        ...normalized,
        textExtractionKind: "failed",
      };
    }
  }

  return {
    enrichAttachments,
    buildPromptContents,
  };
}

function normalizeAttachment(attachment: ChannelAttachment): ChannelAttachment {
  return {
    type: "file",
    filename: typeof attachment.filename === "string" ? attachment.filename : undefined,
    mediaType: typeof attachment.mediaType === "string" ? attachment.mediaType : undefined,
    url: typeof attachment.url === "string" ? attachment.url : undefined,
    textContent:
      typeof attachment.textContent === "string" && attachment.textContent.trim().length > 0
        ? attachment.textContent
        : null,
    textExtractionKind: isExtractionKind(attachment.textExtractionKind)
      ? attachment.textExtractionKind
      : null,
  };
}

function buildAttachmentLabel(attachment: ChannelAttachment): string {
  const name = attachment.filename ?? "Unnamed file";
  const mediaType = attachment.mediaType ? ` (${attachment.mediaType})` : "";
  return attachment.textContent ? `${name}${mediaType} [text extracted]` : `${name}${mediaType}`;
}

function trimAttachmentText(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, MAX_ATTACHMENT_TEXT_CHARS) : null;
}

function parseDataUrl(value: string | undefined): ParsedDataUrl | null {
  if (!value || !value.startsWith("data:")) {
    return null;
  }

  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/is.exec(value);
  if (!match) {
    return null;
  }

  return {
    mediaType: (match[1] ?? "application/octet-stream").toLowerCase(),
    isBase64: Boolean(match[2]),
    payload: match[3] ?? "",
  };
}

function decodeDataUrlPayload(parsed: ParsedDataUrl): Buffer {
  return parsed.isBase64
    ? Buffer.from(parsed.payload, "base64")
    : Buffer.from(decodeURIComponent(parsed.payload), "utf8");
}

function isInlineTextMediaType(mediaType: string): boolean {
  return (
    mediaType.startsWith("text/") ||
    mediaType.includes("json") ||
    mediaType.includes("xml") ||
    mediaType.includes("javascript") ||
    mediaType.includes("typescript") ||
    mediaType.includes("yaml") ||
    mediaType.includes("toml") ||
    mediaType.includes("x-sh") ||
    mediaType.includes("sql")
  );
}

function isExtractionKind(value: unknown): value is ChannelAttachmentTextExtractionKind {
  return (
    value === "inline_text" ||
    value === "pdf_text" ||
    value === "image_ocr" ||
    value === "unsupported" ||
    value === "failed"
  );
}

async function extractPdfText(data: Buffer): Promise<string | null> {
  const loadingTask = getDocument({
    data: new Uint8Array(data),
    useWorkerFetch: false,
    isEvalSupported: false,
    useSystemFonts: true,
  });
  const doc = await loadingTask.promise;

  try {
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
      const page = await doc.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      if (pageText) {
        pages.push(pageText);
      }
    }

    const merged = pages.join("\n\n").trim();
    return merged ? trimAttachmentText(merged) : null;
  } finally {
    await doc.destroy();
  }
}

async function extractImageText(data: Buffer, mediaType: string): Promise<string | null> {
  const worker = new Worker(new URL("./image-ocr-worker.js", import.meta.url));

  try {
    return await new Promise<string | null>((resolve) => {
      const timeout = setTimeout(() => {
        void worker.terminate();
        resolve(null);
      }, OCR_TIMEOUT_MS);

      worker.once("message", (message: { ok: boolean; text?: string | null }) => {
        clearTimeout(timeout);
        void worker.terminate();
        resolve(trimAttachmentText(message.ok ? message.text ?? null : null));
      });

      worker.once("error", () => {
        clearTimeout(timeout);
        void worker.terminate();
        resolve(null);
      });

      worker.postMessage({
        imageBytes: new Uint8Array(data),
        mediaType,
      });
    });
  } catch {
    void worker.terminate();
    return null;
  }
}
