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
 * Where an import lands. The title is carried, not just the id, because the
 * surface reporting progress is not always the component that started it — a
 * root row's import is reported by a toast rendered from Sidebar.
 */
export interface ImportDestination {
  id: string;
  title: string;
}

/**
 * Where a uTab import currently is.
 *
 * `picking` exists because the OS file picker gives no "cancelled" event: the
 * flow returns to idle only when a file actually arrives, or when the user
 * starts over. The destination is carried through so a file chosen seconds
 * later still knows where it belongs.
 */
export type UtabImportState =
  | { kind: "idle" }
  | { kind: "picking"; destination: ImportDestination }
  | {
      kind: "running";
      destination: ImportDestination;
      progress: UtabImportProgress | undefined;
    }
  | { kind: "done"; message: string };

export interface UtabImport {
  state: UtabImportState;
  /** True from the click until the result is acknowledged — disables entry points. */
  busy: boolean;
  /**
   * True only while the import itself is in flight. Deliberately distinct from
   * `busy`: a window must stay dismissable while the OS picker is open, because
   * cancelling that picker leaves nothing running to protect.
   */
  running: boolean;
  /** Must be called synchronously from a click handler — it opens the OS picker. */
  startImport: (destination: ImportDestination) => void;
  onFileChosen: (file: File) => Promise<void>;
  dismissResult: () => void;
}

/**
 * Drives a uTab import: the progress callback, the report download, the summary,
 * and the navigate-away guard. It owns no rendering.
 *
 * Both entry points use it and present it differently — the folder settings
 * window reports inside itself, and the root folder rows, which have no window
 * to report into, use a toast. Keeping presentation out of here is what lets
 * those two surfaces differ without the behaviour differing with them.
 */
export function useUtabImport(
  /**
   * Opens the OS file picker. Supplied by the caller, which owns the hidden
   * input, rather than the hook holding a DOM ref of its own — a ref handed
   * back out of a hook is read during the caller's render, which is exactly
   * what react-hooks/refs forbids. It also keeps the picker's click inside the
   * caller's own gesture, which is what makes the dialog open at all.
   */
  openFilePicker: () => void,
): UtabImport {
  const [state, setState] = useState<UtabImportState>({ kind: "idle" });
  // The picker resolves long after the click, so the destination cannot be read
  // back off the state at that point.
  const destinationRef = useRef<ImportDestination | undefined>(undefined);

  const running = state.kind === "running";

  // Warn before the page unloads while an import is in flight. The canvas stays
  // live during an import, and clicking a bookmark navigates this very tab —
  // that would abandon the run with folders and bookmarks already created and
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

  const startImport = useCallback(
    (destination: ImportDestination) => {
      setState((current) => {
        if (current.kind === "running" || current.kind === "picking") {
          return current;
        }
        destinationRef.current = destination;
        return { kind: "picking", destination };
      });
      // Opening the picker must happen synchronously inside the user gesture,
      // so it is triggered here rather than from an effect reacting to state.
      openFilePicker();
    },
    [openFilePicker],
  );

  const onFileChosen = useCallback(async (file: File) => {
    const destination = destinationRef.current;
    if (!destination) return;
    setState({ kind: "running", destination, progress: undefined });

    // A rejection from file.text() or the importer previously escaped as an
    // unhandled promise and left the dialog stuck on "Importing…" forever.
    // Every exit path must settle the state: it now also gates whether the
    // launching window can be closed at all, not merely what it displays.
    try {
      const text = await file.text();
      const result = await importUtabExport(
        destination.id,
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
      // would show the default icon and never look again. One forced resync at
      // the end catches those.
      forceBookmarkResync();
    } catch (error) {
      setState({
        kind: "done",
        message: `Import failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      });
    } finally {
      destinationRef.current = undefined;
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
    running,
    startImport,
    onFileChosen,
    dismissResult,
  };
}
