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
