import { useState } from "react";
import type { ChangeEvent } from "react";
import { ICON_ERROR_MESSAGES } from "../../lib/icons/errorMessages";
import { removeIcon, uploadIcon } from "../../lib/icons/upload";

interface IconUploadControlsProps {
  itemId: string;
  hasCustomIcon: boolean;
  onChange: (hasCustomIcon: boolean) => void;
}

/**
 * Shared upload/remove UI for a bookmark's or folder's custom icon.
 * Validation (magic-byte format sniffing, size/dimension caps) happens in
 * uploadIcon; a rejected file surfaces an inline error instead of being
 * applied. The item's hasCustomIcon metadata is the caller's
 * responsibility to persist via onChange (bookmarkSettings/folderSettings
 * differ by item type, so this component stays agnostic to which one).
 */
export function IconUploadControls({
  itemId,
  hasCustomIcon,
  onChange,
}: IconUploadControlsProps) {
  const [error, setError] = useState<string | undefined>(undefined);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = await uploadIcon(itemId, file);
    if (!result.ok) {
      setError(
        result.error ? ICON_ERROR_MESSAGES[result.error] : "Upload failed.",
      );
      return;
    }
    setError(undefined);
    onChange(true);
  }

  async function handleRemove() {
    await removeIcon(itemId);
    setError(undefined);
    onChange(false);
  }

  return (
    <div className="icon-upload-controls">
      <label className="icon-upload-label">
        {hasCustomIcon ? "Replace icon" : "Upload icon"}
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/avif"
          className="icon-upload-input"
          onChange={(event) => void handleFileChange(event)}
        />
      </label>
      {hasCustomIcon && (
        <button type="button" onClick={() => void handleRemove()}>
          Remove icon
        </button>
      )}
      {error && (
        <p className="icon-upload-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
