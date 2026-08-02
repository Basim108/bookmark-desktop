import { useEffect, useId } from "react";
import { createPortal } from "react-dom";

interface ImportConfirmWindowProps {
  /** The root folder the import will create its subfolders inside. */
  folder: chrome.bookmarks.BookmarkTreeNode;
  onCancel: () => void;
  /**
   * Opens the OS file picker. Called straight from the button's click handler,
   * never from an effect — a picker opened outside a user gesture is blocked.
   */
  onChooseFile: () => void;
}

/**
 * Confirms the destination before a root-folder import.
 *
 * A deliberately separate component rather than a third mode on
 * FolderSettingsWindow. Reusing that one with its icon and name fields hidden
 * would be less code and would break `folder-sidebar`'s rule that there SHALL
 * be no way to open a settings window for a root folder — the component is the
 * settings window whichever fields happen to be visible.
 *
 * The in-settings import control has no equivalent step: its target is evident
 * from the window it sits in. A row button carries no such context, and
 * importing into a root creates a subfolder per exported folder directly inside
 * it — for the Bookmarks Bar that rewrites Chrome's own visible toolbar.
 */
export function ImportConfirmWindow({
  folder,
  onCancel,
  onChooseFile,
}: ImportConfirmWindowProps) {
  const titleId = useId();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return createPortal(
    <div
      className="folder-settings-window-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        className="folder-settings-window import-confirm-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="folder-settings-window-titlebar">
          <span id={titleId} className="folder-settings-window-title">
            Import uTab Bookmarks
          </span>
          <button
            type="button"
            className="folder-settings-window-close"
            aria-label="Close"
            onClick={onCancel}
          >
            ✕
          </button>
        </div>

        <div className="folder-settings-window-body">
          <p className="import-confirm-text">
            This will create new folders inside:
          </p>
          <p className="import-confirm-target">{folder.title}</p>
          <p className="folder-settings-window-hint">
            Existing bookmarks are not changed or removed.
          </p>
        </div>

        <div className="folder-settings-window-footer">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={onChooseFile}>
            Choose file…
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
