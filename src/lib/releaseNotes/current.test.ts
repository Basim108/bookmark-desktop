import { beforeEach, describe, expect, it } from "vitest";
import { version as packageVersion } from "../../../package.json";
import { installChromeMock } from "../../test/chromeMock";
import { getCurrentReleaseNotes, tryGetCurrentReleaseNotes } from "./current";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

describe("getCurrentReleaseNotes", () => {
  /**
   * Guards the seam between the hand-written changelog and the parser: an entry
   * edited into a shape the parser cannot read would otherwise only surface as
   * an empty notice window in a shipped build.
   */
  it("reads the repository's changelog entry for the running version", () => {
    mock.setManifestVersion(packageVersion);

    const notes = getCurrentReleaseNotes();

    expect(notes.version).toBe(packageVersion);
    expect(notes.changes.length).toBeGreaterThan(0);
  });

  it("throws when the running version has no changelog entry", () => {
    mock.setManifestVersion("99.0.0");

    expect(() => getCurrentReleaseNotes()).toThrow(/99\.0\.0/);
  });
});

describe("tryGetCurrentReleaseNotes", () => {
  it("reads the entry for the running version", () => {
    mock.setManifestVersion(packageVersion);

    expect(tryGetCurrentReleaseNotes()?.version).toBe(packageVersion);
  });

  /**
   * The build guard makes a missing entry unshippable, so this is the
   * belt-and-braces path: the new-tab page is the user's whole browsing
   * surface, and losing it over an absent changelog would be wildly
   * disproportionate. No notes simply means no window.
   */
  it("gives up rather than throwing when the entry is missing", () => {
    mock.setManifestVersion("99.0.0");

    expect(tryGetCurrentReleaseNotes()).toBeUndefined();
  });
});
