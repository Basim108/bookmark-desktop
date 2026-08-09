import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { getReleaseNotice } from "../storage/releaseNotice";
import { handleInstalled, registerReleaseNoticeListener } from "./installEvent";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
  mock.setManifestVersion("1.1.0");
});

describe("handleInstalled", () => {
  it("records a fresh install as seen, announcing nothing", async () => {
    await handleInstalled({ reason: "install" });

    expect(await getReleaseNotice()).toEqual({ seenVersion: "1.1.0" });
  });

  it("leaves an update's notice pending", async () => {
    await handleInstalled({ reason: "update", previousVersion: "1.0.0" });

    expect(await getReleaseNotice()).toEqual({
      pending: { from: "1.0.0", to: "1.1.0" },
    });
  });

  /**
   * The case that makes `reason` the only safe discriminator: everyone
   * upgrading from a version released before this feature existed has no stored
   * seen version. Branching on stored state instead would treat all of them as
   * fresh installs and tell none of them what changed.
   */
  it("treats an update from a version that stored nothing as an update", async () => {
    expect(await getReleaseNotice()).toEqual({});

    await handleInstalled({ reason: "update", previousVersion: "1.0.0" });

    expect((await getReleaseNotice()).pending).toEqual({
      from: "1.0.0",
      to: "1.1.0",
    });
  });

  it("still announces an update that reports no previous version", async () => {
    await handleInstalled({ reason: "update" });

    expect((await getReleaseNotice()).pending?.to).toBe("1.1.0");
  });

  it("records nothing when the browser itself updated", async () => {
    await handleInstalled({ reason: "chrome_update" });

    expect(await getReleaseNotice()).toEqual({});
  });
});

describe("registerReleaseNoticeListener", () => {
  it("subscribes to the install event", () => {
    expect(chrome.runtime.onInstalled.hasListeners()).toBe(false);

    registerReleaseNoticeListener();

    expect(chrome.runtime.onInstalled.hasListeners()).toBe(true);
  });
});
