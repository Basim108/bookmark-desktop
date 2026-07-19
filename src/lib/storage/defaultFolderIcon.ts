import defaultFolderIconUrl from "../../assets/folder.png";
import { DEFAULT_FOLDER_ICON_KEY, getIcon, putIcon } from "./iconDb";

/**
 * Reserved IndexedDB icon key for the single shared default folder icon.
 * Cannot collide with a real Chrome bookmark id (those are numeric strings),
 * so it lives in the same icon store as per-item custom icons and renders
 * through the same object-URL pipeline (`CustomIconImage`). A folder row that
 * has no custom icon renders this key instead of the folder's own id. Defined
 * in iconDb so its prune can exempt it from a single source of truth.
 */
export { DEFAULT_FOLDER_ICON_KEY };

/**
 * Seeds the shared default folder icon into IndexedDB from the bundled asset,
 * once. No-ops if a record already exists under the well-known key, so it's
 * safe to call on every startup. Intentionally not awaited by callers — a
 * folder without a custom icon renders nothing until the seed lands on the
 * very first run, which is acceptable and self-heals on the next paint.
 */
export async function seedDefaultFolderIcon(): Promise<void> {
  if (await getIcon(DEFAULT_FOLDER_ICON_KEY)) {
    return;
  }
  const response = await fetch(defaultFolderIconUrl);
  const blob = await response.blob();
  // Re-check after the async fetch in case a concurrent call already seeded it.
  if (await getIcon(DEFAULT_FOLDER_ICON_KEY)) {
    return;
  }
  await putIcon(DEFAULT_FOLDER_ICON_KEY, blob);
}
