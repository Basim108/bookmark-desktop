import { useCallback, useEffect, useState } from "react";
import { onStorageKeysChanged } from "../../lib/storage/onChanged";
import {
  getReleaseNotice,
  markNoticeSeen,
} from "../../lib/storage/releaseNotice";
import { STORAGE_KEYS } from "../../lib/storage/schema";
import type { PendingNotice } from "../../lib/storage/schema";

interface ReleaseNotice {
  /** The update waiting to be announced, or undefined when there is nothing to say. */
  pending: PendingNotice | undefined;
  /** False until the stored state has been read, so nothing is decided on an unknown. */
  loaded: boolean;
  /** Records the version as seen. Call only on a real dismissal. */
  dismiss: () => Promise<void>;
}

/**
 * The pending release notice, kept in step with every other open new-tab page.
 *
 * Subscribed rather than read once: dismissing the window in one tab must close
 * it in the rest, and Chrome delivers the storage change to every extension
 * context. That is the same mechanism the layout and settings already use to
 * stay in step.
 */
export function useReleaseNotice(): ReleaseNotice {
  const [pending, setPending] = useState<PendingNotice | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function read() {
      const state = await getReleaseNotice();
      if (cancelled) return;
      setPending(state.pending);
      setLoaded(true);
    }

    void read();
    const unsubscribe = onStorageKeysChanged(
      [STORAGE_KEYS.RELEASE_NOTICE],
      () => void read(),
    );
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const dismiss = useCallback(async () => {
    if (pending === undefined) return;
    // Writing the seen version is what clears the pending notice, here and —
    // via chrome.storage.onChanged — in every other open new-tab page.
    await markNoticeSeen(pending.to);
  }, [pending]);

  return { pending, loaded, dismiss };
}
