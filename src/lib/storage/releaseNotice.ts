import { getStorageValue, setStorageValue } from "./local";
import { STORAGE_KEYS } from "./schema";
import type { ReleaseNoticeState } from "./schema";

const EMPTY: ReleaseNoticeState = {};

/**
 * What the user has been told about this installation, and whether an update is
 * waiting to be announced. An absent record means a profile that predates this
 * feature — treated as nothing seen and nothing pending.
 */
export async function getReleaseNotice(): Promise<ReleaseNoticeState> {
  return (await getStorageValue(STORAGE_KEYS.RELEASE_NOTICE)) ?? EMPTY;
}

/**
 * Records a first-time install: the installed version counts as already seen,
 * and nothing is announced. A new user has no history to be told about.
 */
export async function recordInstall(version: string): Promise<void> {
  await setStorageValue(STORAGE_KEYS.RELEASE_NOTICE, { seenVersion: version });
}

/**
 * Records that an update landed, leaving its notice pending for the next
 * new-tab page to show.
 *
 * Deliberately preserves whatever version was already seen rather than
 * overwriting it: the pending notice is what drives the window, and the seen
 * version stays the record of what the user was last told.
 */
export async function recordUpdate(from: string, to: string): Promise<void> {
  const current = await getReleaseNotice();
  await setStorageValue(STORAGE_KEYS.RELEASE_NOTICE, {
    ...current,
    pending: { from, to },
  });
}

/**
 * Records the user's dismissal of the notice window.
 *
 * Called only on a real dismissal — the close control, Escape, or the
 * backdrop — never merely because the window rendered. A window that flashed
 * past during a page load the user abandoned did not deliver its message, so it
 * is shown again on their next unhurried new tab.
 *
 * Clearing the pending notice here is what propagates the dismissal to every
 * other open new-tab page, via chrome.storage.onChanged.
 */
export async function markNoticeSeen(version: string): Promise<void> {
  await setStorageValue(STORAGE_KEYS.RELEASE_NOTICE, { seenVersion: version });
}
