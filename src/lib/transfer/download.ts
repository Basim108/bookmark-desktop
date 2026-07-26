/**
 * Triggers a local download of `data` serialized as pretty-printed JSON, using
 * a transient object-URL anchor. No `chrome.downloads` permission is needed —
 * the file is produced and saved entirely in-page, so nothing leaves the device.
 */
export function downloadJson(data: unknown, filename: string): void {
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    filename,
  );
}

/**
 * Triggers a local download of already-serialized text (the uTab import
 * report's CSV). Shares downloadJson's object-URL anchor, so it likewise needs
 * no `chrome.downloads` permission and nothing leaves the device.
 */
export function downloadText(
  text: string,
  filename: string,
  mimeType = "text/plain",
): void {
  downloadBlob(new Blob([text], { type: mimeType }), filename);
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * The export file name: `YYYY-MM-DD-HH-mm-bookmark-desktop.json`, using the
 * given date's local time (defaults to now).
 */
export function exportFileName(date: Date = new Date()): string {
  const stamp =
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` +
    `-${pad2(date.getHours())}-${pad2(date.getMinutes())}`;
  return `${stamp}-bookmark-desktop.json`;
}

/**
 * The import report file name: the chosen import file's name with any extension
 * stripped, suffixed with `-report.<extension>`. A name without a dot is used
 * as-is. `extension` defaults to `json` so the state-transfer call site keeps
 * its existing `-report.json` output; the uTab importer passes `log`.
 */
export function reportFileName(
  importFileName: string,
  extension = "json",
): string {
  const lastDot = importFileName.lastIndexOf(".");
  const base = lastDot > 0 ? importFileName.slice(0, lastDot) : importFileName;
  return `${base}-report.${extension}`;
}
