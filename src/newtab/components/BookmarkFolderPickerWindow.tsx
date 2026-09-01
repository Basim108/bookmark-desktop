import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  filterFolderEntries,
  type FolderPickerEntry,
} from "../../lib/bookmarks/folderPicker";

export type BookmarkFolderOperation = "copy" | "move";

interface Props {
  operation: BookmarkFolderOperation;
  bookmarkTitle: string;
  sourceFolderId: string;
  folders: readonly FolderPickerEntry[];
  onConfirm: (folderId: string) => Promise<void>;
  onClose: () => void;
}

export function BookmarkFolderPickerWindow({
  operation,
  bookmarkTitle,
  sourceFolderId,
  folders,
  onConfirm,
  onClose,
}: Props) {
  const titleId = useId();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(folders.map((folder) => folder.id)),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const searching = query.trim().length > 0;
  const results = useMemo(
    () => filterFolderEntries(folders, query),
    [folders, query],
  );
  const valid = selectedId !== undefined && selectedId !== sourceFolderId;
  const action = operation === "copy" ? "Copy" : "Move";

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);

  async function submit() {
    if (!valid || !selectedId || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await onConfirm(selectedId);
      onClose();
    } catch {
      setError(
        `“${bookmarkTitle}” could not be ${operation === "copy" ? "copied" : "moved"}. Try again.`,
      );
      setBusy(false);
    }
  }

  function toggle(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderTree(entries: readonly FolderPickerEntry[], depth = 0) {
    return entries.map((entry) => (
      <div
        key={entry.id}
        role="treeitem"
        aria-expanded={
          entry.children.length ? expanded.has(entry.id) : undefined
        }
      >
        <div
          className="bookmark-folder-picker-row"
          style={{ paddingInlineStart: depth * 18 }}
        >
          {entry.children.length ? (
            <button
              type="button"
              className="bookmark-folder-picker-expand"
              aria-label={`${expanded.has(entry.id) ? "Collapse" : "Expand"} ${entry.name}`}
              onClick={() => toggle(entry.id)}
              disabled={busy}
            >
              {expanded.has(entry.id) ? "▾" : "▸"}
            </button>
          ) : (
            <span className="bookmark-folder-picker-spacer" />
          )}
          <button
            type="button"
            className={`bookmark-folder-picker-choice${selectedId === entry.id ? " is-selected" : ""}`}
            onClick={() => setSelectedId(entry.id)}
            disabled={busy}
          >
            {entry.name}
          </button>
        </div>
        {entry.children.length > 0 &&
          expanded.has(entry.id) &&
          renderTree(entry.children, depth + 1)}
      </div>
    ));
  }

  return createPortal(
    <div
      className="bookmark-folder-picker-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && !busy && onClose()
      }
    >
      <section
        className="bookmark-folder-picker-window"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="bookmark-folder-picker-titlebar">
          <h2 id={titleId}>
            {action} “{bookmarkTitle}” to folder
          </h2>
          <button
            type="button"
            aria-label={`Close ${action} bookmark window`}
            onClick={onClose}
            disabled={busy}
          >
            ✕
          </button>
        </header>
        <div className="bookmark-folder-picker-body">
          <label>
            <span>Search folders</span>
            <input
              autoFocus
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={busy}
            />
          </label>
          <div
            className="bookmark-folder-picker-list"
            role={searching ? "listbox" : "tree"}
            aria-label="Folders"
          >
            {searching ? (
              results.length ? (
                results.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    role="option"
                    aria-selected={selectedId === entry.id}
                    className={`bookmark-folder-picker-result${selectedId === entry.id ? " is-selected" : ""}`}
                    onClick={() => setSelectedId(entry.id)}
                    disabled={busy}
                  >
                    {entry.path}
                  </button>
                ))
              ) : (
                <p className="bookmark-folder-picker-empty">
                  No folders found.
                </p>
              )
            ) : (
              renderTree(folders)
            )}
          </div>
          {selectedId === sourceFolderId && (
            <p className="bookmark-folder-picker-hint">
              Choose a different folder.
            </p>
          )}
          {error && (
            <p className="bookmark-folder-picker-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="bookmark-folder-picker-actions">
          <button type="button" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" onClick={submit} disabled={!valid || busy}>
            {busy ? `${action}ing…` : "OK"}
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  );
}
