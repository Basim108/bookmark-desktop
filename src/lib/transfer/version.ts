/**
 * Single source of truth for the extension-state export/import file-format
 * version, in semantic `x.y.z` form:
 *
 * - `x` (major) changes only on a BREAKING format change — an importer of one
 *   major cannot process a file of a different major.
 * - `y` (minor) changes when the format gains a backward-compatible feature.
 * - `z` (patch) changes on a bug fix with no compatibility effect.
 *
 * IMPORTANT (project rule): any change that raises the MAJOR here must be
 * surfaced to the user during the proposal phase — a breaking format bump is
 * never allowed to pass unnoticed, since files of a mismatched major are denied
 * on import and existing backups would be stranded.
 */
export const EXPORT_FORMAT_VERSION = "1.1.0";

export interface SemanticVersion {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parses a strict `x.y.z` version string into its numeric parts. Returns
 * undefined for anything that is not three dot-separated non-negative integers
 * (including non-strings), so an untrusted file's `version` field can be fed in
 * directly.
 */
export function parseVersion(value: unknown): SemanticVersion | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) {
    return undefined;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export type ImportCompatibility = "ok" | "too-old" | "too-new" | "invalid";

/**
 * Decides whether a file carrying `fileVersion` can be imported by this build.
 * Only the major version gates compatibility: an equal major is importable
 * regardless of minor/patch; a lower major is a format this build no longer
 * reads (`too-old`); a higher major is a newer format this build predates
 * (`too-new`). A missing or malformed version is `invalid`.
 */
export function checkImportCompatibility(
  fileVersion: unknown,
): ImportCompatibility {
  const parsed = parseVersion(fileVersion);
  if (!parsed) {
    return "invalid";
  }
  const current = parseVersion(EXPORT_FORMAT_VERSION)!;
  if (parsed.major === current.major) {
    return "ok";
  }
  return parsed.major < current.major ? "too-old" : "too-new";
}
