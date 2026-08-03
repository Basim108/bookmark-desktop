import { createPortal } from "react-dom";
import { Spinner } from "./Spinner";
import type { UtabImportProgress } from "../../lib/import/utab";

interface ImportToastProps {
  /** Progress while running, or the final message once it has settled. */
  progress?: UtabImportProgress | undefined;
  /**
   * Name of the folder being imported into. Shown while running because this
   * surface serves the entry point that has no window of its own — nothing else
   * on screen says where the import is landing. A window-started import needs
   * no such label and does not use this component.
   */
  destinationName?: string | undefined;
  message?: string | undefined;
  /** Present only for the result, which waits to be acknowledged. */
  onDismiss?: (() => void) | undefined;
}

/**
 * Progress and outcome of a root-folder import.
 *
 * Rendered through a portal, deliberately not inside the sidebar: the sidebar
 * can be dragged down to 40px, and a toast clipped to it would be unreadable
 * exactly when it matters most.
 *
 * The result does not auto-dismiss. It names the downloaded report file, and a
 * timed message would take that filename away mid-read — the same reasoning
 * that makes the state-transfer import wait for acknowledgement before
 * reloading.
 */
export function ImportToast({
  progress,
  destinationName,
  message,
  onDismiss,
}: ImportToastProps) {
  const done = message !== undefined;
  const into = destinationName ? ` into ${destinationName}` : "";

  return createPortal(
    // Named, because dnd-kit renders its own role="status" live region into the
    // same document — an unnamed one here would be indistinguishable from it to
    // assistive technology as well as to tests.
    <div
      className="import-toast"
      role="status"
      aria-live="polite"
      aria-label="Import status"
    >
      {done ? (
        <>
          <p className="import-toast-message">{message}</p>
          <button
            type="button"
            className="import-toast-dismiss"
            onClick={onDismiss}
          >
            OK
          </button>
        </>
      ) : (
        <p className="import-toast-message">
          <Spinner className="import-toast-spinner" />
          {/* The count is omitted until the first progress callback lands, so
              the toast never flashes a meaningless "0 / 0". */}
          {progress
            ? `Importing${into}… ${progress.processed} / ${progress.total}`
            : `Importing${into}…`}
        </p>
      )}
    </div>,
    document.body,
  );
}
