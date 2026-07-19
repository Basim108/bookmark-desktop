import { useEffect, useId, useState } from "react";
import type { ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { removeBookmark, updateBookmark } from "../../lib/bookmarks/edit";
import { isSafeNavigationUrl } from "../../lib/bookmarks/urlSafety";
import { ICON_ERROR_MESSAGES } from "../../lib/icons/errorMessages";
import { validateIconFile } from "../../lib/icons/validation";
import {
  setBookmarkHasCustomIcon,
  setBookmarkLabelDisplay,
} from "../../lib/storage/bookmarkSettings";
import { deleteIcon, putIcon } from "../../lib/storage/iconDb";
import type { BookmarkSettings } from "../../lib/storage/schema";
import { CustomIconImage } from "./CustomIconImage";
import { FaviconImage } from "./FaviconImage";

interface EditBookmarkWindowProps {
  bookmark: chrome.bookmarks.BookmarkTreeNode;
  settings: BookmarkSettings;
  /** Bumped by the caller's settings hook; forwarded to CustomIconImage so the current icon refetches. */
  iconVersion: number;
  /** Called after a successful Save so the caller can refresh (e.g. reload settings/icon). */
  onSaved: () => void;
  onClose: () => void;
}

/**
 * Staged icon edit. `unchanged` keeps whatever the bookmark already shows;
 * `upload` holds a validated, in-memory image (previewed via an object URL,
 * not yet written to IndexedDB); `removed` reverts to the favicon. Nothing is
 * persisted until Save — closing the window discards the staged state.
 */
type PendingIcon =
  | { kind: "unchanged" }
  | { kind: "upload"; file: File; previewUrl: string }
  | { kind: "removed" };

const PREVIEW_ICON_SIZE = 64;

/**
 * Centered, opaque "Edit Bookmark" window (portaled to document.body) for a
 * single bookmark: icon, name, URL, label visibility, and removal. All edits
 * are staged and applied atomically on Save; the close control, backdrop, and
 * Escape discard them. Removal deletes the real Chrome bookmark after a
 * confirmation step and relies on the events.ts onRemoved cascade for cleanup.
 */
export function EditBookmarkWindow({
  bookmark,
  settings,
  iconVersion,
  onSaved,
  onClose,
}: EditBookmarkWindowProps) {
  const titleId = useId();
  const nameId = useId();
  const urlId = useId();

  const [name, setName] = useState(bookmark.title);
  const [url, setUrl] = useState(bookmark.url ?? "");
  const [showUnderIcon, setShowUnderIcon] = useState(
    settings.labelDisplay === "under-icon",
  );
  const [pendingIcon, setPendingIcon] = useState<PendingIcon>({
    kind: "unchanged",
  });
  const [iconError, setIconError] = useState<string | undefined>(undefined);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [saving, setSaving] = useState(false);

  const nameValid = name.trim().length > 0;
  const urlValid = isSafeNavigationUrl(url);
  const canSave = nameValid && urlValid && !saving;
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

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);

    if (pendingIcon.kind === "upload") {
      await putIcon(bookmark.id, pendingIcon.file);
      await setBookmarkHasCustomIcon(bookmark.id, true);
    } else if (pendingIcon.kind === "removed") {
      await deleteIcon(bookmark.id);
      await setBookmarkHasCustomIcon(bookmark.id, false);
    }

    const result = await updateBookmark(bookmark.id, { title: name, url });
    if (!result.ok) {
      setSaving(false);
      return;
    }

    await setBookmarkLabelDisplay(
      bookmark.id,
      showUnderIcon ? "under-icon" : "tooltip",
    );

    onSaved();
    onClose();
  }

  async function handleRemove() {
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      return;
    }
    await removeBookmark(bookmark.id);
    onClose();
  }

  function renderPreview() {
    if (pendingIcon.kind === "upload") {
      return (
        <img src={pendingIcon.previewUrl} alt={name} className="custom-icon" />
      );
    }
    if (pendingIcon.kind === "unchanged" && settings.hasCustomIcon) {
      return (
        <CustomIconImage
          itemId={bookmark.id}
          alt={name}
          version={iconVersion}
        />
      );
    }
    if (bookmark.url) {
      return (
        <FaviconImage url={bookmark.url} size={PREVIEW_ICON_SIZE} alt={name} />
      );
    }
    return <span className="favicon-fallback" aria-hidden="true" />;
  }

  return createPortal(
    <div
      className="edit-bookmark-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className="edit-bookmark-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="edit-bookmark-titlebar">
          <span id={titleId} className="edit-bookmark-title">
            Edit Bookmark
          </span>
          <button
            type="button"
            className="edit-bookmark-close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="edit-bookmark-body">
          <div className="edit-bookmark-icon-row">
            <div className="edit-bookmark-icon-preview">{renderPreview()}</div>
            <div className="edit-bookmark-image-controls">
              <p className="edit-bookmark-hint">
                Upload a custom image for this bookmark.
              </p>
              <div className="edit-bookmark-image-buttons">
                <label className="edit-bookmark-upload-button">
                  Upload image
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/avif"
                    className="edit-bookmark-upload-input"
                    onChange={(event) => void handleFileChange(event)}
                  />
                </label>
                {hasCustomIconNow && (
                  <button
                    type="button"
                    className="edit-bookmark-remove-image"
                    onClick={handleRemoveImage}
                  >
                    Remove image
                  </button>
                )}
              </div>
              {iconError && (
                <p className="edit-bookmark-image-error" role="alert">
                  {iconError}
                </p>
              )}
            </div>
          </div>

          <div className="edit-bookmark-field">
            <label className="edit-bookmark-field-label" htmlFor={nameId}>
              Name
            </label>
            <input
              id={nameId}
              type="text"
              className="edit-bookmark-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="edit-bookmark-field">
            <label className="edit-bookmark-field-label" htmlFor={urlId}>
              URL
            </label>
            <input
              id={urlId}
              type="text"
              className="edit-bookmark-input"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-invalid={url.length > 0 && !urlValid}
            />
          </div>

          <div className="edit-bookmark-field">
            <span className="edit-bookmark-field-label">Label</span>
            <label className="edit-bookmark-checkbox">
              <input
                type="checkbox"
                checked={showUnderIcon}
                onChange={(event) => setShowUnderIcon(event.target.checked)}
              />
              Show label under icon
            </label>
          </div>

          {url.length > 0 && !urlValid && (
            <p className="edit-bookmark-input-error" role="alert">
              Enter a valid URL (http or https).
            </p>
          )}
        </div>

        <div className="edit-bookmark-actions">
          <button
            type="button"
            className="edit-bookmark-remove"
            onClick={() => void handleRemove()}
          >
            {confirmingRemove ? "Confirm remove" : "Remove"}
          </button>
          <button
            type="button"
            className="edit-bookmark-save"
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
