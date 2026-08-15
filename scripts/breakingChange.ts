import { parseReleaseEntry } from "../src/lib/releaseNotes/parse.ts";

/** One commit as `git log` hands it over: subject line plus body. */
export interface Commit {
  hash: string;
  subject: string;
  body: string;
}

/**
 * A conventional-commit subject whose type carries the `!` breaking marker —
 * `feat!:` or `feat(scope)!:`.
 *
 * Anchored at the start so a `!` quoted later in the subject cannot match,
 * which is what keeps `Revert "feat(api)!: ..."` from reading as a new breaking
 * change rather than the undoing of one.
 */
const BANG_MARKER = /^[a-z]+(\([^)]*\))?!:/;

/**
 * The footer, which the Conventional Commits spec allows in either spelling.
 * Must open a line: prose mentioning a breaking change mid-sentence is not a
 * declaration of one.
 */
const FOOTER = /^BREAKING[ -]CHANGE:/m;

/**
 * Commits since the previous release that declare a breaking change.
 *
 * Both signals are checked, and the footer is the load-bearing one. This
 * repository's only real case is `fix(canvas): store bookmark positions as
 * capacity-free slots` — a `fix` with a footer and no `!` — so a detector keyed
 * on the marker alone would have let that release ship unannounced, which is
 * the exact failure this guard exists to prevent.
 */
export function findBreakingCommits(commits: Commit[]): Commit[] {
  return commits.filter(
    (commit) => BANG_MARKER.test(commit.subject) || FOOTER.test(commit.body),
  );
}

/**
 * Whether the changelog entry for `version` lacks the heads-up a breaking
 * change requires.
 *
 * A missing or unreadable entry counts as missing: the guard's job is to
 * confirm users will be told, and an entry that cannot be parsed will not be
 * shown to them either — the build guard in vite.config.ts fails on the same
 * condition.
 *
 * Reuses the parser the extension itself reads the changelog with, so the guard
 * cannot drift from what actually ships.
 */
export function headsUpMissing(changelog: string, version: string): boolean {
  try {
    return parseReleaseEntry(changelog, version).headsUp === undefined;
  } catch {
    return true;
  }
}
