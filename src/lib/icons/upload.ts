import { deleteIcon, putIcon } from "../storage/iconDb";
import { validateIconFile } from "./validation";
import type { IconValidationResult } from "./validation";

/**
 * Validates then stores an icon's bytes in IndexedDB for the given
 * bookmark or folder id. Caller is responsible for updating the
 * hasCustomIcon metadata mirror (bookmarkSettings/folderSettings) only
 * when the result is ok — this function never touches that layer, since
 * it doesn't know which kind of item it was called for.
 */
export async function uploadIcon(
  itemId: string,
  file: File,
): Promise<IconValidationResult> {
  const result = await validateIconFile(file);
  if (!result.ok) {
    return result;
  }
  await putIcon(itemId, file);
  return { ok: true };
}

export async function removeIcon(itemId: string): Promise<void> {
  await deleteIcon(itemId);
}
