import { useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { removeFolder, updateFolderTitle } from "../../lib/bookmarks/edit";
import { ICON_ERROR_MESSAGES } from "../../lib/icons/errorMessages";
import { validateIconFile } from "../../lib/icons/validation";
import { importUtabExport } from "../../lib/import/utab";
import type { UtabImportSummary } from "../../lib/import/utab";
import { setFolderHasCustomIcon } from "../../lib/storage/folderSettings";
import { DEFAULT_FOLDER_ICON_KEY } from "../../lib/storage/defaultFolderIcon";
import { deleteIcon, putIcon } from "../../lib/storage/iconDb";
import type { FolderSettings } from "../../lib/storage/schema";
import { CustomIconImage } from "./CustomIconImage";

function pluralize(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

/** Human-readable summary of an import, e.g. "Imported 2 folders, 24 bookmarks — skipped 1." */
function formatImportSummary(summary: UtabImportSummary): string {
  const base = `Imported ${pluralize(summary.foldersCreated, "folder")}, ${pluralize(
    summary.bookmarksCreated,
    "bookmark",
  )}`;
  return summary.skipped > 0
    ? `${base} — skipped ${summary.skipped}.`
    : `${base}.`;
}

interface FolderSettingsWindowProps {
  folder: chrome.bookmarks.BookmarkTreeNode;
  settings: FolderSettings;
  /** Bumped by the caller's settings hook; forwarded to CustomIconImage so the current icon refetches. */
  iconVersion: number;
  /** Called after a successful Save so the caller can refresh (e.g. reload settings/icon). */
  onSaved: () => void;
  onClose: () => void;
}

/**
 * Staged icon edit. `unchanged` keeps whatever the folder already shows;
 * `upload` holds a validated, in-memory image (previewed via an object URL,
 * not yet written to IndexedDB); `removed` clears the custom icon. Nothing is
 * persisted until Save — closing the window discards the staged state.
 */
type PendingIcon =
  | { kind: "unchanged" }
  | { kind: "upload"; file: File; previewUrl: string }
  | { kind: "removed" };

/**
 * Centered, opaque "Folder Settings" window (portaled to document.body) for a
 * single folder: icon, name, and removal. Styled to match the Edit Bookmark
 * window. Every folder row always shows its icon and name, so there is no
 * display-mode choice here — only whether the folder has a custom icon (else
 * the shared default folder icon is shown). All edits are staged and applied
 * atomically on Save; the close control, backdrop, and Escape discard them.
 * Removal deletes the real Chrome folder (and its subtree) after a
 * confirmation step and relies on the events.ts onRemoved cascade for cleanup.
 */
export function FolderSettingsWindow({
  folder,
  settings,
  iconVersion,
  onSaved,
  onClose,
}: FolderSettingsWindowProps) {
  const titleId = useId();
  const nameId = useId();

  const [name, setName] = useState(folder.title);
  const [pendingIcon, setPendingIcon] = useState<PendingIcon>({
    kind: "unchanged",
  });
  const [iconError, setIconError] = useState<string | undefined>(undefined);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string | undefined>(
    undefined,
  );
  const importFileInputRef = useRef<HTMLInputElement>(null);

  const nameValid = name.trim().length > 0;
  const canSave = nameValid && !saving;
  // "Has a custom icon" for the staged state: a pending upload counts, a
  // pending removal does not, and otherwise it's whatever the folder already
  // has. Drives the "Remove image" button and the preview (custom icon vs. the
  // shared default), reflecting the staged state before Save.
  const hasCustomIconNow =
    pendingIcon.kind === "upload" ||
    (pendingIcon.kind === "unchanged" && settings.hasCustomIcon);

  // Revoke the staged upload's object URL when it's replaced or the window
  // unmounts, so a discarded preview never leaks.
  useEffect(() => {
    if (pendingIcon.kind !== "upload") return;
    const { previewUrl } = pendingIcon;
    return () => URL.revokeObjectURL(previewUrl);
  }, [pendingIcon]);

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
    const result = await validateIconFile(file);
    if (!result.ok) {
      setIconError(
        result.error ? ICON_ERROR_MESSAGES[result.error] : "Upload failed.",
      );
      return;
    }
    setIconError(undefined);
    setPendingIcon({
      kind: "upload",
      file,
      previewUrl: URL.createObjectURL(file),
    });
  }

  function handleRemoveImage() {
    setIconError(undefined);
    setPendingIcon({ kind: "removed" });
  }

  // Opening the OS file picker must happen synchronously inside a user-gesture
  // handler, so the menu item triggers the hidden input's click directly.
  function handleImportUtabClick() {
    setImportMenuOpen(false);
    importFileInputRef.current?.click();
  }

  async function handleImportFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || importing) return;
    setImporting(true);
    setImportResult(undefined);

    const text = await file.text();
    const result = await importUtabExport(folder.id, text);
    setImporting(false);

    if (!result.ok) {
      setImportResult(
        result.error === "invalid-json"
          ? "That file isn’t valid JSON."
          : "That file isn’t a uTab export.",
      );
      return;
    }
    setImportResult(formatImportSummary(result.summary));
    // Import creates real bookmarks/folders immediately (not a staged edit), so
    // refresh the caller without closing the window — the summary stays visible.
    onSaved();
  }

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);

    if (pendingIcon.kind === "upload") {
      await putIcon(folder.id, pendingIcon.file);
      await setFolderHasCustomIcon(folder.id, true);
    } else if (pendingIcon.kind === "removed") {
      await deleteIcon(folder.id);
      await setFolderHasCustomIcon(folder.id, false);
    }

    const result = await updateFolderTitle(folder.id, name);
    if (!result.ok) {
      setSaving(false);
      return;
    }

    onSaved();
    onClose();
  }

  async function handleRemove() {
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      return;
    }
    await removeFolder(folder.id);
    onClose();
  }

  function renderPreview() {
    if (pendingIcon.kind === "upload") {
      return (
        <img
          src={pendingIcon.previewUrl}
          alt={folder.title}
          className="custom-icon"
        />
      );
    }
    if (pendingIcon.kind === "unchanged" && settings.hasCustomIcon) {
      return (
        <CustomIconImage
          itemId={folder.id}
          alt={folder.title}
          version={iconVersion}
        />
      );
    }
    // No custom icon staged: preview the shared default folder icon, matching
    // what the sidebar row will actually render.
    return (
      <CustomIconImage
        itemId={DEFAULT_FOLDER_ICON_KEY}
        alt={folder.title}
        version={iconVersion}
      />
    );
  }

  return createPortal(
    <div
      className="folder-settings-window-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="folder-settings-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="folder-settings-window-titlebar">
          <span id={titleId} className="folder-settings-window-title">
            Folder Settings
          </span>
          <button
            type="button"
            className="folder-settings-window-close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="folder-settings-window-body">
          <div className="folder-settings-window-icon-row">
            <div className="folder-settings-window-icon-preview">
              {renderPreview()}
            </div>
            <div className="folder-settings-window-image-controls">
              <p className="folder-settings-window-hint">
                Upload a custom image for this folder.
              </p>
              <div className="folder-settings-window-image-buttons">
                <label className="folder-settings-window-upload-button">
                  Upload image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    className="folder-settings-window-upload-input"
                    onChange={(event) => void handleFileChange(event)}
                  />
                </label>
                {hasCustomIconNow && (
                  <button
                    type="button"
                    className="folder-settings-window-remove-image"
                    onClick={handleRemoveImage}
                  >
                    Remove image
                  </button>
                )}
              </div>
              {iconError && (
                <p className="folder-settings-window-image-error" role="alert">
                  {iconError}
                </p>
              )}
            </div>
          </div>

          <div className="folder-settings-window-field">
            <label
              className="folder-settings-window-field-label"
              htmlFor={nameId}
            >
              Name
            </label>
            <input
              id={nameId}
              type="text"
              className="folder-settings-window-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              aria-invalid={name.length > 0 && !nameValid}
            />
          </div>

          {name.length > 0 && !nameValid && (
            <p className="folder-settings-window-input-error" role="alert">
              Enter a folder name.
            </p>
          )}

          <div className="folder-settings-window-import">
            <button
              type="button"
              className="folder-settings-window-import-toggle"
              aria-haspopup="menu"
              aria-expanded={importMenuOpen}
              disabled={importing}
              onClick={() => setImportMenuOpen((open) => !open)}
            >
              Import Bookmarks ▾
            </button>
            {importMenuOpen && (
              <div className="folder-settings-window-import-menu" role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className="folder-settings-window-import-item"
                  onClick={handleImportUtabClick}
                >
                  Import uTab
                </button>
              </div>
            )}
            <input
              ref={importFileInputRef}
              type="file"
              accept=".json,application/json"
              aria-label="Import bookmarks file"
              className="folder-settings-window-upload-input"
              onChange={(event) => void handleImportFileChange(event)}
            />
            {importing && (
              <p className="folder-settings-window-hint" role="status">
                Importing…
              </p>
            )}
            {!importing && importResult && (
              <p className="folder-settings-window-import-result" role="status">
                {importResult}
              </p>
            )}
          </div>
        </div>

        <div className="folder-settings-window-actions">
          <button
            type="button"
            className="folder-settings-window-remove"
            onClick={() => void handleRemove()}
          >
            {confirmingRemove ? "Confirm remove" : "Remove folder"}
          </button>
          <button
            type="button"
            className="folder-settings-window-save"
            onClick={() => void handleSave()}
            disabled={!canSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
