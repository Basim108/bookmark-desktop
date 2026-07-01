import { MAX_ICON_DIMENSION_PX, MAX_ICON_FILE_SIZE_BYTES } from "./validation";
import type { IconValidationError } from "./validation";

export const ICON_ERROR_MESSAGES: Record<IconValidationError, string> = {
  "unsupported-format": "Unsupported file type — use PNG, JPEG, WebP, or AVIF.",
  "file-too-large": `File exceeds the ${Math.round(MAX_ICON_FILE_SIZE_BYTES / 1_000_000)} MB limit.`,
  "dimensions-too-large": `Image exceeds ${MAX_ICON_DIMENSION_PX}×${MAX_ICON_DIMENSION_PX} pixels.`,
};
