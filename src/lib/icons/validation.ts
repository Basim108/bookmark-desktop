export const MAX_ICON_FILE_SIZE_BYTES = 1_000_000; // 1 MB
export const MAX_ICON_DIMENSION_PX = 512;

export type AcceptedIconFormat = "png" | "jpeg" | "webp" | "avif";

export type IconValidationError =
  "unsupported-format" | "file-too-large" | "dimensions-too-large";

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

/** Returns undefined if the browser can't actually decode the bytes — e.g. a file with a matching magic-byte header that's otherwise truncated or corrupted. */
async function readImageDimensions(
  blob: Blob,
): Promise<{ width: number; height: number } | undefined> {
  try {
    const bitmap = await createImageBitmap(blob);
    try {
      return { width: bitmap.width, height: bitmap.height };
    } finally {
      bitmap.close();
    }
  } catch {
    return undefined;
  }
}

/**
 * Full upload-validation pipeline for a user-selected icon file. Order is
 * deliberate: file size and a magic-byte header check are cheap and run
 * before the pixel-dimension check, which requires a full image decode.
 */
export async function validateIconFile(
  file: File,
): Promise<IconValidationResult> {
  if (file.size > MAX_ICON_FILE_SIZE_BYTES) {
    return { ok: false, error: "file-too-large" };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = sniffIconFormat(bytes);
  if (!format) {
    return { ok: false, error: "unsupported-format" };
  }

  const dimensions = await readImageDimensions(file);
  if (!dimensions) {
    return { ok: false, error: "unsupported-format" };
  }
  if (
    dimensions.width > MAX_ICON_DIMENSION_PX ||
    dimensions.height > MAX_ICON_DIMENSION_PX
  ) {
    return { ok: false, error: "dimensions-too-large" };
  }

  return { ok: true };
}
