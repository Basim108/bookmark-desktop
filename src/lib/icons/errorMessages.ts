import {
  MAX_BACKGROUND_FILE_SIZE_BYTES,
  MAX_ICON_FILE_SIZE_BYTES,
} from "./validation";
import type { IconValidationError } from "./validation";

export const ICON_ERROR_MESSAGES: Record<IconValidationError, string> = {
  "unsupported-format": "Unsupported file type — use PNG, JPEG, WebP, or AVIF.",
  "file-too-large": `File exceeds the ${Math.round(MAX_ICON_FILE_SIZE_BYTES / 1_000_000)} MB limit.`,
};

export const BACKGROUND_ERROR_MESSAGES: Record<IconValidationError, string> = {
  "unsupported-format": "Unsupported file type — use PNG, JPEG, WebP, or AVIF.",
  "file-too-large": `File exceeds the ${Math.round(MAX_BACKGROUND_FILE_SIZE_BYTES / 1_000_000)} MB limit.`,
};
