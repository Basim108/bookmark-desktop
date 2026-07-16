import { getStorageValue, setStorageValue } from "./local";
import { STORAGE_KEYS } from "./schema";
import type { CanvasBackground, GeneralSettings } from "./schema";

export const DEFAULT_GENERAL_SETTINGS: GeneralSettings = {
  background: { kind: "none" },
};

/** Reads the global settings object, falling back to the defaults when unset. */
export async function getGeneralSettings(): Promise<GeneralSettings> {
  const stored = await getStorageValue(STORAGE_KEYS.GENERAL_SETTINGS);
  return stored ?? DEFAULT_GENERAL_SETTINGS;
}

export async function setGeneralSettings(
  settings: GeneralSettings,
): Promise<void> {
  await setStorageValue(STORAGE_KEYS.GENERAL_SETTINGS, settings);
}

/**
 * Writes just the canvas background, preserving any other global settings. The
 * uploaded image's bytes are managed separately in IndexedDB (see
 * canvasBackground.ts); this only records the metadata (presence + fit).
 */
export async function setCanvasBackground(
  background: CanvasBackground,
): Promise<void> {
  const current = await getGeneralSettings();
  await setGeneralSettings({ ...current, background });
}
