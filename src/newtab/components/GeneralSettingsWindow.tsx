import { useEffect, useId, useRef, useState } from "react";
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
import {
  downloadJson,
  exportFileName,
  reportFileName,
} from "../../lib/transfer/download";
import { exportState } from "../../lib/transfer/exportState";
import { importState } from "../../lib/transfer/importState";
import type {
  ImportChoice,
  ImportDenial,
} from "../../lib/transfer/importState";

const DENIAL_MESSAGES: Record<ImportDenial, string> = {
  "invalid-json": "That file isn't a valid Bookmark Desktop backup.",
  "invalid-version": "That file isn't a valid Bookmark Desktop backup.",
  "too-old":
    "This backup uses an older format this version can no longer import.",
  "too-new":
    "This backup was made by a newer version. Please update the extension and try again.",
};

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

  // Export/Import ("Backup & Restore"). `busy` disables all footer buttons
  // while any of them runs; `transferMessage` shows an import denial (a
  // successful export closes the window; a successful import reloads the page).
  const [busy, setBusy] = useState(false);
  const [transferMessage, setTransferMessage] = useState<string | undefined>(
    undefined,
  );
  const importInputRef = useRef<HTMLInputElement>(null);

  // Custom Yes/No/Cancel backup confirmation. `confirmImport` opens it and
  // returns a promise resolved when the user clicks a choice; the resolver is
  // held in a ref so the button handlers can settle the awaiting import.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const confirmResolverRef = useRef<((choice: ImportChoice) => void) | null>(
    null,
  );

  // After an import that skipped entries: the summary the user must acknowledge
  // before the page reloads (so the message isn't erased by an immediate reload).
  const [summary, setSummary] = useState<
    { skipped: number; reportName: string } | undefined
  >(undefined);

  function answerConfirm(choice: ImportChoice) {
    setConfirmOpen(false);
    confirmResolverRef.current?.(choice);
    confirmResolverRef.current = null;
  }

  async function runBackup() {
    downloadJson(await exportState(), exportFileName());
  }

  async function handleExport() {
    if (busy || saving) return;
    setBusy(true);
    setTransferMessage(undefined);
    try {
      await runBackup();
      onClose(); // behaves like Save: closes on success
    } catch {
      setTransferMessage("Export failed. Please try again.");
      setBusy(false);
    }
  }

  async function handleImportFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy || saving) return;

    setBusy(true);
    setTransferMessage(undefined);
    try {
      const text = await file.text();
      const result = await importState(text, {
        confirmImport: () =>
          new Promise<ImportChoice>((resolve) => {
            confirmResolverRef.current = resolve;
            setConfirmOpen(true);
          }),
        performBackup: runBackup,
      });

      if (result.ok) {
        if (result.skipped.length > 0) {
          const reportName = reportFileName(file.name);
          downloadJson(result.skipped, reportName);
          // Don't reload yet — show a summary pointing at the report file and
          // reload only once the user acknowledges it (a reload would erase it).
          setSummary({ skipped: result.skipped.length, reportName });
          return;
        }
        // Clean import: reload so the fully replaced tree renders with a valid
        // selection (React state still holds now-deleted folder ids). This also
        // dismisses the window.
        window.location.reload();
        return;
      }
      if ("denied" in result) {
        setTransferMessage(DENIAL_MESSAGES[result.denied]);
      }
      // aborted (user chose Cancel): stay open silently.
      setBusy(false);
    } catch {
      setTransferMessage("Import failed. Please try again.");
      setBusy(false);
    }
  }

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
      if (event.key !== "Escape") return;
      // A shown summary must be acknowledged with Reload; don't dismiss it.
      if (summary) return;
      // A running transfer must not be dismissed out from under itself.
      if (busy) return;
      // Escape cancels a pending import confirmation (settling its promise)
      // rather than closing the whole window and leaving the import hung.
      if (confirmOpen) {
        setConfirmOpen(false);
        confirmResolverRef.current?.("cancel");
        confirmResolverRef.current = null;
        return;
      }
      onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, confirmOpen, summary, busy]);

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

  // While a confirmation or post-import summary is showing, the window renders
  // only that panel (so it collapses to the panel's natural size), takes the
  // alertdialog role, and its backdrop/close no longer dismiss it — the panel's
  // own buttons are the only way out.
  const overlay = confirmOpen ? "confirm" : summary ? "summary" : undefined;

  // `busy` covers the transfer itself. Dismissing mid-import would unmount this
  // window while importState kept running: the skipped-items report would still
  // auto-download with nothing on screen to explain it, setSummary would no-op
  // on the unmounted component, and the user would never get the summary or the
  // reload prompt — leaving the UI referencing folders the import deleted.
  const dismissable = !overlay && !busy;

  return createPortal(
    <div
      className="general-settings-window-backdrop"
      onClick={(event) => {
        if (dismissable && event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="general-settings-window"
        role={overlay ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-label={overlay ? "Import Bookmarks" : undefined}
        aria-labelledby={overlay ? undefined : titleId}
      >
        {overlay === "confirm" ? (
          <>
            <div className="general-settings-window-titlebar">
              <span className="general-settings-window-title">
                Import Bookmarks
              </span>
            </div>
            <div className="general-settings-confirm">
              <p className="general-settings-confirm-text">
                Importing will <strong>replace</strong> all of your current
                bookmarks and desktop settings. Back up your current setup
                first?
              </p>
              <div className="general-settings-confirm-actions">
                <button
                  type="button"
                  className="general-settings-window-transfer"
                  onClick={() => answerConfirm("cancel")}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="general-settings-window-transfer"
                  onClick={() => answerConfirm("no-backup")}
                >
                  No
                </button>
                <button
                  type="button"
                  className="general-settings-window-save"
                  onClick={() => answerConfirm("backup")}
                >
                  Yes
                </button>
              </div>
            </div>
          </>
        ) : overlay === "summary" ? (
          <>
            <div className="general-settings-window-titlebar">
              <span className="general-settings-window-title">
                Import Bookmarks
              </span>
            </div>
            <div className="general-settings-confirm">
              <p className="general-settings-confirm-text">
                Import finished, but {summary!.skipped} item
                {summary!.skipped === 1 ? "" : "s"} could not be imported. A
                report was saved to your downloads as{" "}
                <strong>{summary!.reportName}</strong>.
              </p>
              <div className="general-settings-confirm-actions">
                <button
                  type="button"
                  className="general-settings-window-save"
                  onClick={() => window.location.reload()}
                >
                  Reload
                </button>
              </div>
            </div>
          </>
        ) : (
          renderSettingsBody()
        )}
      </div>
    </div>,
    document.body,
  );

  function renderSettingsBody() {
    return (
      <>
        <div className="general-settings-window-titlebar">
          <span id={titleId} className="general-settings-window-title">
            Settings
          </span>
          <button
            type="button"
            className="general-settings-window-close"
            aria-label="Close"
            disabled={busy}
            onClick={() => {
              if (dismissable) onClose();
            }}
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

        {transferMessage && (
          <p className="general-settings-window-transfer-message" role="alert">
            {transferMessage}
          </p>
        )}

        <div className="general-settings-window-actions">
          <div className="general-settings-window-actions-left">
            <button
              type="button"
              className="general-settings-window-transfer"
              onClick={() => void handleExport()}
              disabled={busy || saving}
            >
              Export
            </button>
            <button
              type="button"
              className="general-settings-window-transfer"
              onClick={() => importInputRef.current?.click()}
              disabled={busy || saving}
            >
              Import
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".json,application/json"
              aria-label="Import backup file"
              className="general-settings-window-upload-input"
              onChange={(event) => void handleImportFile(event)}
            />
          </div>
          <button
            type="button"
            className="general-settings-window-save"
            onClick={() => void handleSave()}
            disabled={saving || busy}
          >
            Save
          </button>
        </div>
      </>
    );
  }
}
