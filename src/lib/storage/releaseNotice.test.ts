import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import {
  getReleaseNotice,
  markNoticeSeen,
  recordInstall,
  recordUpdate,
} from "./releaseNotice";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

describe("release notice state", () => {
  it("reads an empty state when nothing has been recorded", async () => {
    expect(await getReleaseNotice()).toEqual({});
  });

  it("records a fresh install as already seen, with nothing pending", async () => {
    await recordInstall("1.1.0");

    expect(await getReleaseNotice()).toEqual({ seenVersion: "1.1.0" });
  });

  it("records an update as a pending notice naming both versions", async () => {
    await recordUpdate("1.0.0", "1.1.0");

    expect(await getReleaseNotice()).toEqual({
      pending: { from: "1.0.0", to: "1.1.0" },
    });
  });

  it("records an update even when no version was ever seen", async () => {
    // Every user upgrading from a version released before this feature existed
    // has no stored seen version, and is nonetheless an update.
    await recordUpdate("1.0.0", "1.1.0");

    expect((await getReleaseNotice()).pending).toEqual({
      from: "1.0.0",
      to: "1.1.0",
    });
  });

  it("marks the version seen and clears the pending notice on dismissal", async () => {
    await recordUpdate("1.0.0", "1.1.0");

    await markNoticeSeen("1.1.0");

    expect(await getReleaseNotice()).toEqual({ seenVersion: "1.1.0" });
  });

  it("keeps the version seen across a later update", async () => {
    await markNoticeSeen("1.1.0");

    await recordUpdate("1.1.0", "1.2.0");

    expect(await getReleaseNotice()).toEqual({
      seenVersion: "1.1.0",
      pending: { from: "1.1.0", to: "1.2.0" },
    });
  });
});
