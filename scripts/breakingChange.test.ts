import { describe, expect, it } from "vitest";
import { findBreakingCommits, headsUpMissing } from "./breakingChange";

/** A commit as the guard receives it: subject plus body. */
function commit(subject: string, body = "") {
  return { hash: "abc1234", subject, body };
}

describe("findBreakingCommits", () => {
  it("detects a BREAKING CHANGE footer", () => {
    const commits = [
      commit(
        "fix(canvas): store bookmark positions as capacity-free slots",
        "BREAKING CHANGE: the positions storage key changes shape.",
      ),
    ];

    expect(findBreakingCommits(commits)).toHaveLength(1);
  });

  /**
   * The load-bearing case. This repository's one real breaking change is a
   * `fix` carrying a footer and no `!`, so a detector keyed only on the marker
   * would have missed it and let the release ship unannounced.
   */
  it("detects a footer on a fix, not only on a feat", () => {
    const commits = [
      commit("fix(canvas): store positions as slots", "BREAKING CHANGE: yes."),
    ];

    expect(findBreakingCommits(commits)).toHaveLength(1);
  });

  it("detects a ! type marker", () => {
    expect(
      findBreakingCommits([commit("feat(api)!: drop the v1 endpoint")]),
    ).toHaveLength(1);
  });

  it("detects a ! marker with no scope", () => {
    expect(
      findBreakingCommits([commit("feat!: drop the v1 endpoint")]),
    ).toHaveLength(1);
  });

  it("counts a commit carrying both signals once", () => {
    const commits = [commit("feat!: drop it", "BREAKING CHANGE: dropped.")];

    expect(findBreakingCommits(commits)).toHaveLength(1);
  });

  it("accepts the BREAKING-CHANGE hyphenated spelling the spec allows", () => {
    expect(
      findBreakingCommits([commit("feat: thing", "BREAKING-CHANGE: yes.")]),
    ).toHaveLength(1);
  });

  it("finds nothing in ordinary commits", () => {
    const commits = [
      commit("feat(canvas): turn pages with a horizontal mouse wheel"),
      commit("fix(sidebar): keep a folder's row when a drop moves nothing"),
      commit("chore(deps-dev): bump vite from 8.1.5 to 8.2.0"),
    ];

    expect(findBreakingCommits(commits)).toEqual([]);
  });

  it("does not fire on the word appearing mid-sentence", () => {
    const commits = [
      commit(
        "docs: explain the breaking change policy",
        "No breaking change here.",
      ),
    ];

    expect(findBreakingCommits(commits)).toEqual([]);
  });

  it("does not mistake a revert of a breaking commit's subject for one", () => {
    // The subject quotes a `!` marker but this commit undoes it rather than
    // introducing one.
    expect(
      findBreakingCommits([
        commit('Revert "feat(api)!: drop the v1 endpoint"'),
      ]),
    ).toEqual([]);
  });

  it("reports every breaking commit, not just the first", () => {
    const commits = [
      commit("feat!: one"),
      commit("fix: two", "BREAKING CHANGE: also."),
      commit("chore: three"),
    ];

    expect(findBreakingCommits(commits)).toHaveLength(2);
  });
});

describe("headsUpMissing", () => {
  const CHANGELOG = `# Changelog

## 1.1.0

> Your icons settle into place once after this update.

- A change

## 1.0.0

- The first release
`;

  it("passes when a breaking change has its heads-up", () => {
    expect(headsUpMissing(CHANGELOG, "1.1.0")).toBe(false);
  });

  it("fails when the entry declares no heads-up", () => {
    expect(headsUpMissing(CHANGELOG, "1.0.0")).toBe(true);
  });

  it("fails when the version has no entry at all", () => {
    expect(headsUpMissing(CHANGELOG, "9.9.9")).toBe(true);
  });
});
