import { parentPort } from "node:worker_threads";
import OCRAD from "ocrad.js/ocrad.js";
import sharp from "sharp";

type OcrWorkerRequest = {
  imageBytes: Uint8Array;
  mediaType?: string;
};

type OcrWorkerResponse =
  | {
      ok: true;
      text: string | null;
    }
  | {
      ok: false;
      error: string;
    };

async function runImageOcr(input: OcrWorkerRequest): Promise<string | null> {
  // OCRAD expects RGBA image data, so we decode with sharp and expand the
  // normalized grayscale pixels back into a 4-channel buffer.
  const { data, info } = await sharp(Buffer.from(input.imageBytes))
    .greyscale()
    .normalise()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const rgba = new Uint8ClampedArray(info.width * info.height * 4);
  for (let index = 0; index < data.length; index += 1) {
    const value = data[index] ?? 0;
    const offset = index * 4;
    rgba[offset] = value;
    rgba[offset + 1] = value;
    rgba[offset + 2] = value;
    rgba[offset + 3] = 255;
  }

  const imageData = {
    width: info.width,
    height: info.height,
    data: rgba,
  };

  const result = OCRAD(imageData);
  if (typeof result !== "string") {
    return null;
  }

  const normalized = result
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();

  return normalized || null;
}

if (!parentPort) {
  throw new Error("OCR worker requires a parent port");
}

parentPort.on("message", async (message: OcrWorkerRequest) => {
  try {
    const text = await runImageOcr(message);
    const response: OcrWorkerResponse = { ok: true, text };
    parentPort?.postMessage(response);
  } catch (error) {
    const response: OcrWorkerResponse = {
      ok: false,
      error: error instanceof Error ? error.message : "Image OCR failed",
    };
    parentPort?.postMessage(response);
  }
});
