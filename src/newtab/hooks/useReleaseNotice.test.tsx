import { beforeEach, describe, expect, it } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { installChromeMock } from "../../test/chromeMock";
import {
  getReleaseNotice,
  markNoticeSeen,
  recordUpdate,
} from "../../lib/storage/releaseNotice";
import { useReleaseNotice } from "./useReleaseNotice";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

describe("useReleaseNotice", () => {
  it("reports nothing to announce on a profile with no pending notice", async () => {
    const { result } = renderHook(() => useReleaseNotice());

    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.pending).toBeUndefined();
  });

  it("reports the notice an update left pending", async () => {
    await recordUpdate("1.0.0", "1.1.0");

    const { result } = renderHook(() => useReleaseNotice());

    await waitFor(() =>
      expect(result.current.pending).toEqual({ from: "1.0.0", to: "1.1.0" }),
    );
  });

  it("records the version as seen when the user dismisses it", async () => {
    await recordUpdate("1.0.0", "1.1.0");
    const { result } = renderHook(() => useReleaseNotice());
    await waitFor(() => expect(result.current.pending).toBeDefined());

    await act(async () => {
      await result.current.dismiss();
    });

    expect(await getReleaseNotice()).toEqual({ seenVersion: "1.1.0" });
    expect(result.current.pending).toBeUndefined();
  });

  /**
   * The cross-tab path: one dismissal settles every open new-tab page, so a
   * user with pinned tabs is not asked to dismiss the same window repeatedly.
   */
  it("stops reporting the notice when another page dismisses it", async () => {
    await recordUpdate("1.0.0", "1.1.0");
    const { result } = renderHook(() => useReleaseNotice());
    await waitFor(() => expect(result.current.pending).toBeDefined());

    await act(async () => {
      await markNoticeSeen("1.1.0");
    });

    await waitFor(() => expect(result.current.pending).toBeUndefined());
  });

  it("reports a notice recorded after the page was already open", async () => {
    const { result } = renderHook(() => useReleaseNotice());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    await act(async () => {
      await recordUpdate("1.0.0", "1.1.0");
    });

    await waitFor(() =>
      expect(result.current.pending).toEqual({ from: "1.0.0", to: "1.1.0" }),
    );
  });
});
