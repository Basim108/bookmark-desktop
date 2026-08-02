import { useCallback, useEffect, useRef, useState } from "react";
import { forceBookmarkResync } from "../../lib/bookmarks/events";
import { importUtabExport } from "../../lib/import/utab";
import type { UtabImportProgress } from "../../lib/import/utab";
import {
  formatImportReport,
  formatImportSummary,
} from "../../lib/import/report";
import { downloadText, reportFileName } from "../../lib/transfer/download";

/**
 * Where a root-folder import currently is.
 *
 * `picking` exists because the OS file picker gives no "cancelled" event: the
 * confirmation closes as soon as the picker is opened, and the flow returns to
 * idle only when a file actually arrives or the user starts over. The target
 * folder is carried through so a file chosen seconds later still knows where it
 * belongs.
 */
export type RootImportState =
  | { kind: "idle" }
  | { kind: "confirming"; folder: chrome.bookmarks.BookmarkTreeNode }
  | { kind: "picking"; folder: chrome.bookmarks.BookmarkTreeNode }
  | {
      kind: "running";
      folder: chrome.bookmarks.BookmarkTreeNode;
      progress: UtabImportProgress | undefined;
    }
  | { kind: "done"; message: string };

export interface RootFolderImport {
  state: RootImportState;
  /** True from the moment a file is chosen until the result is acknowledged. */
  busy: boolean;
  requestImport: (folder: chrome.bookmarks.BookmarkTreeNode) => void;
  cancelConfirm: () => void;
  /** Must be called synchronously from a click handler — it opens the OS picker. */
  confirmAndPickFile: () => void;
  onFileChosen: (file: File) => Promise<void>;
  dismissResult: () => void;
}

/**
 * Owns the root-folder import flow: confirmation, file selection, the running
 * import, and the result the user must acknowledge.
 *
 * Held above the folder rows (see Sidebar) for two reasons. One import at a
 * time has to be enforceable across *every* root row, and the toast must
 * outlive a row re-render — live bookmark sync refetches the tree continuously
 * while an import creates items, so state owned by a row would be destroyed
 * mid-flight.
 */
export function useRootFolderImport(
  /**
   * Opens the OS file picker. Supplied by the caller, which owns the hidden
   * input, rather than the hook holding a DOM ref of its own — a ref handed
   * back out of a hook is read during the caller's render, which is exactly
   * what react-hooks/refs forbids.
   */
  openFilePicker: () => void,
): RootFolderImport {
  const [state, setState] = useState<RootImportState>({ kind: "idle" });
  // The picker resolves long after the confirmation closed, so the target
  // cannot be read back off the state at that point.
  const targetRef = useRef<chrome.bookmarks.BookmarkTreeNode | undefined>(
    undefined,
  );

  const running = state.kind === "running";

  // Warn before the page unloads while an import is in flight. The canvas stays
  // live during a root import, and clicking a bookmark navigates this very tab
  // — that would abandon the run with folders and bookmarks already created and
  // no report written, since the report is emitted only once the importer
  // finishes or fails.
  //
  // The cleanup runs on unmount as well as when the import settles. Without
  // that, a stale handler would survive and put a spurious "Leave site?" prompt
  // on every later navigation — a failure that only ever shows up in some
  // unrelated flow, long after this code is out of mind.
  useEffect(() => {
    if (!running) return;
    function warn(event: BeforeUnloadEvent) {
      event.preventDefault();
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [running]);

  const requestImport = useCallback(
    (folder: chrome.bookmarks.BookmarkTreeNode) => {
      setState((current) =>
        current.kind === "running" ? current : { kind: "confirming", folder },
      );
    },
    [],
  );

  const cancelConfirm = useCallback(() => {
    targetRef.current = undefined;
    setState((current) =>
      current.kind === "confirming" ? { kind: "idle" } : current,
    );
  }, []);

  const confirmAndPickFile = useCallback(() => {
    setState((current) => {
      if (current.kind !== "confirming") return current;
      targetRef.current = current.folder;
      return { kind: "picking", folder: current.folder };
    });
    // Opening the picker must happen synchronously inside the user gesture, so
    // it is triggered here rather than from an effect reacting to the state.
    openFilePicker();
  }, [openFilePicker]);

  const onFileChosen = useCallback(async (file: File) => {
    const folder = targetRef.current;
    if (!folder) return;
    setState({ kind: "running", folder, progress: undefined });

    // Mirrors the guard in FolderSettingsWindow: a rejection from file.text()
    // or the importer previously escaped as an unhandled promise and left the
    // dialog pending forever. The toast must not be able to hang the same
    // way, so every exit path resolves it.
    try {
      const text = await file.text();
      const result = await importUtabExport(
        folder.id,
        text,
        (progress: UtabImportProgress) => {
          setState((current) =>
            current.kind === "running" ? { ...current, progress } : current,
          );
        },
      );

      if (!result.ok) {
        setState({
          kind: "done",
          message:
            result.error === "invalid-json"
              ? "That file isn’t valid JSON."
              : "That file isn’t a uTab export.",
        });
        return;
      }

      let reportName: string | undefined;
      if (result.rows.length > 0) {
        reportName = reportFileName(file.name, "log");
        downloadText(formatImportReport(result.rows), reportName, "text/csv");
      }
      setState({
        kind: "done",
        message: formatImportSummary(result.summary, result.rows, reportName),
      });
      // The tree and canvas already refetch from chrome.bookmarks events as
      // items are created, but the icons an import attaches are written to
      // storage just after each node exists — a row that mounted in between
      // would show the default icon and never look again. One forced resync
      // at the end catches those.
      forceBookmarkResync();
    } catch (error) {
      setState({
        kind: "done",
        message: `Import failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    } finally {
      targetRef.current = undefined;
    }
  }, []);

  const dismissResult = useCallback(() => {
    setState((current) =>
      current.kind === "done" ? { kind: "idle" } : current,
    );
  }, []);

  return {
    state,
    // Covers `picking` too: the OS dialog is open and a second import must not
    // be startable behind it.
    busy: state.kind === "picking" || state.kind === "running",
    requestImport,
    cancelConfirm,
    confirmAndPickFile,
    onFileChosen,
    dismissResult,
  };
}
