/**
 * Decodes a base64 image data URL (e.g. a uTab export's `preview` field,
 * `data:image/png;base64,iVBORw0K…`) into a Blob so it can go through the
 * shared icon-validation pipeline and be stored via putIcon. Returns undefined
 * for anything that is not a decodable base64 data URL — a plain http(s) URL, a
 * malformed string, or invalid base64 — so the caller can simply skip the icon
 * and fall back to the default. Only base64-encoded data URLs are supported;
 * icon previews are always base64, and this avoids decoding arbitrary
 * URL-encoded payloads.
 */
export function dataUrlToBlob(value: string): Blob | undefined {
  const match = /^data:([^;,]+);base64,(.*)$/s.exec(value);
  if (!match) {
    return undefined;
  }
  const mimeType = match[1] ?? "application/octet-stream";
  const base64 = match[2] ?? "";
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  } catch {
    return undefined;
  }
}

/**
 * Encodes a Blob as a base64 data URL (the inverse of dataUrlToBlob), used by
 * export to inline a stored icon's bytes into the JSON file. Reads the bytes and
 * base64-encodes them directly rather than via FileReader so it works uniformly
 * across page and worker contexts; the Blob's MIME type is preserved so the
 * decoded Blob round-trips with the same `type`.
 */
/**
 * Chunk size for the binary-string build below. Kept well under the engine's
 * argument-count limit for a spread call, which is what caps this rather than
 * memory.
 */
const ENCODE_CHUNK_SIZE = 0x8000;

export async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  // Built a chunk at a time rather than byte by byte: a 10 MB background image
  // is ~10M iterations and string concatenations otherwise, on the main thread,
  // during every export and every pre-import backup.
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += ENCODE_CHUNK_SIZE) {
    chunks.push(
      String.fromCharCode(...bytes.subarray(i, i + ENCODE_CHUNK_SIZE)),
    );
  }
  const mimeType = blob.type || "application/octet-stream";
  return `data:${mimeType};base64,${btoa(chunks.join(""))}`;
}
