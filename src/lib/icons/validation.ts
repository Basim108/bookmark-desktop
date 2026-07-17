export const MAX_ICON_FILE_SIZE_BYTES = 1_000_000; // 1 MB
export const MAX_BACKGROUND_FILE_SIZE_BYTES = 10_000_000; // 10 MB

export type AcceptedIconFormat = "png" | "jpeg" | "webp" | "avif";

export type IconValidationError = "unsupported-format" | "file-too-large";

export interface IconValidationResult {
  ok: boolean;
  error?: IconValidationError;
}

function bytesMatch(
  bytes: Uint8Array,
  expected: number[],
  offset: number,
): boolean {
  if (bytes.length < offset + expected.length) return false;
  return expected.every((byte, i) => bytes[offset + i] === byte);
}

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

interface FormatSignature {
  format: AcceptedIconFormat;
  matches: (bytes: Uint8Array) => boolean;
}

const SIGNATURES: FormatSignature[] = [
  {
    format: "png",
    matches: (b) =>
      bytesMatch(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0),
  },
  { format: "jpeg", matches: (b) => bytesMatch(b, [0xff, 0xd8, 0xff], 0) },
  {
    format: "webp",
    matches: (b) =>
      bytesMatch(b, ascii("RIFF"), 0) && bytesMatch(b, ascii("WEBP"), 8),
  },
  {
    // ISO BMFF container: bytes 4-7 are always "ftyp"; the brand at bytes
    // 8-11 identifies AVIF specifically (still/image-sequence variants).
    format: "avif",
    matches: (b) =>
      bytesMatch(b, ascii("ftyp"), 4) &&
      (bytesMatch(b, ascii("avif"), 8) || bytesMatch(b, ascii("avis"), 8)),
  },
];

/**
 * Detects an image's actual format from its byte signature (magic bytes),
 * never its file extension or claimed MIME type. Returns undefined for SVG
 * and any other unrecognized format — the caller treats that as rejected.
 */
export function sniffIconFormat(
  bytes: Uint8Array,
): AcceptedIconFormat | undefined {
  return SIGNATURES.find((signature) => signature.matches(bytes))?.format;
}

/** Returns false if the browser can't actually decode the bytes — e.g. a file with a matching magic-byte header that's otherwise truncated or corrupted. */
async function canDecodeImage(blob: Blob): Promise<boolean> {
  try {
    const bitmap = await createImageBitmap(blob);
    bitmap.close();
    return true;
  } catch {
    return false;
  }
}

/**
 * Shared upload-validation pipeline for an image blob. File size and a
 * magic-byte header check are cheap and run before the decode check, which
 * requires fully decoding the image. Pixel dimensions are unbounded — every
 * rendering site scales the image to fit its own display size. The only thing
 * that varies by call site is the maximum file size. Accepts any Blob (a File
 * is a Blob) so a base64 data URL decoded during import can reuse the exact
 * same checks as a user-selected upload.
 */
async function validateImageFile(
  file: Blob,
  maxSizeBytes: number,
): Promise<IconValidationResult> {
  if (file.size > maxSizeBytes) {
    return { ok: false, error: "file-too-large" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = sniffIconFormat(bytes);
  if (!format) {
    return { ok: false, error: "unsupported-format" };
  }

  if (!(await canDecodeImage(file))) {
    return { ok: false, error: "unsupported-format" };
  }

  return { ok: true };
}

/** Validates an icon image (≤ 1 MB; png/jpeg/webp/avif). Accepts a File upload or a Blob decoded from an import's data URL. */
export function validateIconFile(file: Blob): Promise<IconValidationResult> {
  return validateImageFile(file, MAX_ICON_FILE_SIZE_BYTES);
}

/**
 * Validates a user-selected canvas background image. Same accepted formats and
 * decode check as icons, but with a larger 10 MB cap, since a full-canvas
 * background is legitimately much bigger than an icon.
 */
export function validateBackgroundFile(
  file: Blob,
): Promise<IconValidationResult> {
  return validateImageFile(file, MAX_BACKGROUND_FILE_SIZE_BYTES);
}
