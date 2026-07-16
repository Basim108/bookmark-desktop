import { deleteIcon, getIcon, putIcon } from "./iconDb";

/**
 * Reserved IndexedDB key for the single canvas background image. Cannot collide
 * with a real Chrome bookmark id (those are numeric strings), so the background
 * image lives in the same icon store as per-item custom icons and the shared
 * default folder icon, reusing the same put/get/delete pipeline.
 */
export const CANVAS_BACKGROUND_KEY = "__canvas_background__";

export function putCanvasBackground(blob: Blob): Promise<void> {
  return putIcon(CANVAS_BACKGROUND_KEY, blob);
}

export function getCanvasBackground(): Promise<Blob | undefined> {
  return getIcon(CANVAS_BACKGROUND_KEY);
}

export function deleteCanvasBackground(): Promise<void> {
  return deleteIcon(CANVAS_BACKGROUND_KEY);
}
