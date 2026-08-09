import { recordInstall, recordUpdate } from "../storage/releaseNotice";

/**
 * Records what the next new-tab page should announce, if anything.
 *
 * The branch is on the event's own `reason` and never on whether a seen version
 * is already stored. Every user upgrading from a version released before this
 * feature existed has no stored version and is nonetheless an update; inferring
 * "new user" from missing state would tell exactly the wrong population
 * nothing.
 *
 * Reasons other than install and update — a browser upgrade, a shared module —
 * change nothing about the extension the user is running, so they announce
 * nothing.
 */
export async function handleInstalled(
  details: chrome.runtime.InstalledDetails,
): Promise<void> {
  const version = chrome.runtime.getManifest().version;
  if (details.reason === "install") {
    await recordInstall(version);
    return;
  }
  if (details.reason === "update") {
    // previousVersion is typed optional; the notice is worth leaving pending
    // either way, since what the window shows is the version just installed.
    await recordUpdate(details.previousVersion ?? "", version);
  }
}

/**
 * Subscribes the service worker to install and update events.
 *
 * This has to live in the service worker rather than in the new-tab page: an
 * update commonly lands while no new-tab page is open at all, and the event
 * fires once. The page reads what was recorded instead of trying to observe the
 * update itself.
 */
export function registerReleaseNoticeListener(): void {
  chrome.runtime.onInstalled.addListener((details) => {
    void handleInstalled(details);
  });
}
