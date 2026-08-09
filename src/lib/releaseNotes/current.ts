import changelogSource from "../../../CHANGELOG.md?raw";
import { parseReleaseEntry } from "./parse";
import type { ReleaseEntry } from "./parse";

/**
 * The running version's user-facing notes.
 *
 * The changelog is inlined into the bundle at build time rather than fetched:
 * the extension's published privacy policy states that the only outbound
 * requests are the declared favicon fetches, and a request to a release API
 * would contradict it — for a changelog.
 *
 * The version comes from the manifest rather than from package.json, so what is
 * looked up is the version actually running. The two agree by construction
 * (manifest.config.ts derives the manifest version from the package metadata),
 * and the build guard in vite.config.ts fails the build if the entry is
 * missing, so this cannot throw in a shipped build.
 */
export function getCurrentReleaseNotes(): ReleaseEntry {
  return parseReleaseEntry(
    changelogSource,
    chrome.runtime.getManifest().version,
  );
}

/**
 * The running version's notes, or undefined when they cannot be read.
 *
 * The build guard already makes a missing entry unshippable, so this is the
 * belt-and-braces path for the UI: the new-tab page is the user's whole
 * browsing surface, and throwing during its render would take the page down
 * over a changelog. No notes means no window, and nothing else changes.
 */
export function tryGetCurrentReleaseNotes(): ReleaseEntry | undefined {
  try {
    return getCurrentReleaseNotes();
  } catch {
    return undefined;
  }
}
