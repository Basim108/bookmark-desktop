import { getStorageValue, setStorageValue } from "./local";
import { STORAGE_KEYS } from "./schema";

export const DEFAULT_SIDEBAR_WIDTH = 240;
export const MIN_SIDEBAR_WIDTH = 40;

/** Reads the persisted sidebar width, clamped to the minimum and falling back to the default if unset. */
export async function getSidebarWidth(): Promise<number> {
  const stored = await getStorageValue(STORAGE_KEYS.SIDEBAR_WIDTH);
  if (stored === undefined) {
    return DEFAULT_SIDEBAR_WIDTH;
  }
  return Math.max(MIN_SIDEBAR_WIDTH, stored);
}

export async function setSidebarWidth(width: number): Promise<void> {
  await setStorageValue(
    STORAGE_KEYS.SIDEBAR_WIDTH,
    Math.max(MIN_SIDEBAR_WIDTH, width),
  );
}
