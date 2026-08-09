import { describe, expect, it } from "vitest";
import { parseReleaseEntry } from "./parse";

const FULL = `# Changelog

Intro prose that is not part of any entry.

## 1.1.0

> Your icons settle into place once after this update.

- Turn pages with your mouse wheel
- Bring your uTab bookmarks across in a single step

Alongside these, a number of fixes and refinements.

## 1.0.0

- The first release
`;

describe("parseReleaseEntry", () => {
  it("reads the heads-up, the changes, and the fixes note of an entry", () => {
    expect(parseReleaseEntry(FULL, "1.1.0")).toEqual({
      version: "1.1.0",
      headsUp: "Your icons settle into place once after this update.",
      changes: [
        "Turn pages with your mouse wheel",
        "Bring your uTab bookmarks across in a single step",
      ],
      fixesNote: "Alongside these, a number of fixes and refinements.",
    });
  });

  it("stops at the next version heading", () => {
    expect(parseReleaseEntry(FULL, "1.0.0").changes).toEqual([
      "The first release",
    ]);
  });

  it("leaves the heads-up undefined when the entry declares none", () => {
    expect(parseReleaseEntry(FULL, "1.0.0").headsUp).toBeUndefined();
  });

  it("leaves the fixes note undefined when the entry has no closing sentence", () => {
    expect(parseReleaseEntry(FULL, "1.0.0").fixesNote).toBeUndefined();
  });

  it("joins a change's continuation lines into one line of prose", () => {
    const changelog = `## 2.0.0

- Bring your uTab bookmarks across in a single step, with a clear report
  of anything that needed your attention
`;
    expect(parseReleaseEntry(changelog, "2.0.0").changes).toEqual([
      "Bring your uTab bookmarks across in a single step, with a clear report of anything that needed your attention",
    ]);
  });

  it("joins a wrapped heads-up into one sentence", () => {
    const changelog = `## 2.0.0

> Your icons settle into place once after this update, and stay put from
> then on — nothing has been lost.

- A change
`;
    expect(parseReleaseEntry(changelog, "2.0.0").headsUp).toBe(
      "Your icons settle into place once after this update, and stay put from then on — nothing has been lost.",
    );
  });

  it("joins a wrapped fixes note into one sentence", () => {
    const changelog = `## 2.0.0

- A change

Alongside these, a number of fixes and refinements to icon layout, grid
sizing, and the settings windows.
`;
    expect(parseReleaseEntry(changelog, "2.0.0").fixesNote).toBe(
      "Alongside these, a number of fixes and refinements to icon layout, grid sizing, and the settings windows.",
    );
  });

  it("throws naming the version when the changelog has no entry for it", () => {
    expect(() => parseReleaseEntry(FULL, "9.9.9")).toThrow(/9\.9\.9/);
  });

  it("throws when an entry lists no changes", () => {
    const changelog = `## 2.0.0

> A heads-up with nothing to accompany it.
`;
    expect(() => parseReleaseEntry(changelog, "2.0.0")).toThrow(/2\.0\.0/);
  });

  it("does not mistake a similarly prefixed version for the requested one", () => {
    const changelog = `## 1.1.0

- The entry that must not be returned

## 1.1

- The entry for a different version
`;
    expect(parseReleaseEntry(changelog, "1.1").changes).toEqual([
      "The entry for a different version",
    ]);
  });
});
