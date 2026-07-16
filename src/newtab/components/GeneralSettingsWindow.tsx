import { useEffect, useId, useState } from "react";
import type { ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { BACKGROUND_ERROR_MESSAGES } from "../../lib/icons/errorMessages";
import { validateBackgroundFile } from "../../lib/icons/validation";
import {
  deleteCanvasBackground,
  putCanvasBackground,
} from "../../lib/storage/canvasBackground";
import { setCanvasBackground } from "../../lib/storage/generalSettings";
import type { BackgroundFit, CanvasBackground } from "../../lib/storage/schema";

interface GeneralSettingsWindowProps {
  /** The currently saved canvas background, used to seed the staged state. */
  background: CanvasBackground;
  /** Current object URL of the saved background image, shown in the preview when nothing new is staged. */
  savedBackgroundUrl: string | undefined;
  /** Called after a successful Save so the caller can re-read the background. */
  onSaved: () => void;
  onClose: () => void;
}

/**
 * Staged background edit. `unchanged` keeps whatever is saved; `upload` holds a
 * validated, in-memory image (previewed via an object URL, not yet written to
 * IndexedDB); `removed` clears the background. Nothing is persisted until Save —
 * closing the window discards the staged state. The fit mode is tracked
 * separately so it can be changed independently of the image.
 */
type PendingBackground =
  | { kind: "unchanged" }
  | { kind: "upload"; file: File; previewUrl: string }
  | { kind: "removed" };

const FIT_OPTIONS: { value: BackgroundFit; label: string }[] = [
  { value: "cover", label: "Cover" },
  { value: "contain", label: "Contain" },
  { value: "center", label: "Center" },
];

/**
 * Centered, opaque "Settings" window (portaled to document.body) for global,
 * page-wide settings. Styled to match the Folder Settings / Edit Bookmark
 * windows. For now it holds a single setting — the canvas background: upload an
 * image, remove it, and choose how it fits. All edits are staged and applied
 * atomically on Save; the close control, backdrop, and Escape discard them.
 */
export function GeneralSettingsWindow({
  background,
  savedBackgroundUrl,
  onSaved,
  onClose,
}: GeneralSettingsWindowProps) {
  const titleId = useId();

  const [pending, setPending] = useState<PendingBackground>({
    kind: "unchanged",
  });
  const [fit, setFit] = useState<BackgroundFit>(
    background.kind === "upload" ? background.fit : "cover",
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Whether a background image will exist after Save, given the staged state.
  const hasBackgroundNow =
    pending.kind === "upload" ||
    (pending.kind === "unchanged" && background.kind === "upload");

  // Revoke the staged upload's object URL when it's replaced or the window
  // unmounts, so a discarded preview never leaks.
  useEffect(() => {
    if (pending.kind !== "upload") return;
    const { previewUrl } = pending;
    return () => URL.revokeObjectURL(previewUrl);
  }, [pending]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const result = await validateBackgroundFile(file);
    if (!result.ok) {
      setError(
        result.error
          ? BACKGROUND_ERROR_MESSAGES[result.error]
          : "Upload failed.",
      );
      return;
    }
    setError(undefined);
    setPending({
      kind: "upload",
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  function handleRemove() {
    setError(undefined);
    setPending({ kind: "removed" });
  }

  async function handleSave() {
    if (saving) return;
    setSaving(true);

    if (pending.kind === "upload") {
      await putCanvasBackground(pending.file);
      await setCanvasBackground({ kind: "upload", fit });
    } else if (pending.kind === "removed") {
      await deleteCanvasBackground();
      await setCanvasBackground({ kind: "none" });
    } else if (background.kind === "upload") {
      // Image unchanged, but the fit mode may have changed.
      await setCanvasBackground({ kind: "upload", fit });
    }

    onSaved();
    onClose();
  }

  function renderPreview() {
    if (pending.kind === "upload") {
      return (
        <img
          src={pending.previewUrl}
          alt="Background preview"
          className="custom-icon"
        />
      );
    }
    if (pending.kind === "unchanged" && savedBackgroundUrl) {
      return (
        <img
          src={savedBackgroundUrl}
          alt="Background preview"
          className="custom-icon"
        />
      );
    }
    return (
      <span className="general-settings-window-no-background">
        No background
      </span>
    );
  }

  return createPortal(
    <div
      className="general-settings-window-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="general-settings-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="general-settings-window-titlebar">
          <span id={titleId} className="general-settings-window-title">
            Settings
          </span>
          <button
            type="button"
            className="general-settings-window-close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="general-settings-window-body">
          <div className="general-settings-window-field-group">
            <span className="general-settings-window-field-title">
              Background
            </span>
            <div className="general-settings-window-icon-row">
              <div className="general-settings-window-preview">
                {renderPreview()}
              </div>
              <div className="general-settings-window-image-controls">
                <p className="general-settings-window-hint">
                  Upload an image to use as the canvas background.
                </p>
                <div className="general-settings-window-image-buttons">
                  <label className="general-settings-window-upload-button">
                    Upload image
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/avif"
                      className="general-settings-window-upload-input"
                      onChange={(event) => void handleFileChange(event)}
                    />
                  </label>
                  {hasBackgroundNow && (
                    <button
                      type="button"
                      className="general-settings-window-remove-image"
                      onClick={handleRemove}
                    >
                      Remove image
                    </button>
                  )}
                </div>
                {error && (
                  <p
                    className="general-settings-window-image-error"
                    role="alert"
                  >
                    {error}
                  </p>
                )}
              </div>
            </div>

            {hasBackgroundNow && (
              <fieldset className="general-settings-window-fit">
                <legend className="general-settings-window-fit-legend">
                  Fit
                </legend>
                <div className="general-settings-window-radio-group">
                  {FIT_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className="general-settings-window-radio"
                    >
                      <input
                        type="radio"
                        name="background-fit"
                        value={option.value}
                        checked={fit === option.value}
                        onChange={() => setFit(option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        </div>

        <div className="general-settings-window-actions">
          <button
            type="button"
            className="general-settings-window-save"
            onClick={() => void handleSave()}
            disabled={saving}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
