import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { findBreakingCommits, headsUpMissing } from "./breakingChange.ts";
import type { Commit } from "./breakingChange.ts";

/**
 * Refuses a version whose breaking change would reach users unannounced.
 *
 * Run on the pull request rather than at release time, deliberately: on a PR a
 * missing heads-up costs one line of the changelog, while at release time it
 * costs a version number, since the store will not accept a re-upload of one
 * already used.
 *
 * Exits 0 when there is nothing to announce or the announcement is present, and
 * 1 with the offending commits named otherwise.
 */

/** Record and unit separators, so a commit body containing newlines survives. */
const RECORD = "\x1e";
const UNIT = "\x1f";

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" });
}

/**
 * The tag the previous release was cut from, or undefined on a repository that
 * has never released — in which case every commit is in range.
 */
function previousTag(): string | undefined {
  try {
    return git("describe", "--tags", "--abbrev=0").trim() || undefined;
  } catch {
    return undefined;
  }
}

function commitsSince(tag: string | undefined): Commit[] {
  const range = tag === undefined ? "HEAD" : `${tag}..HEAD`;
  const out = git("log", range, `--format=%H${UNIT}%s${UNIT}%b${RECORD}`);
  return out
    .split(RECORD)
    .map((record) => record.trim())
    .filter((record) => record !== "")
    .map((record) => {
      const [hash = "", subject = "", body = ""] = record.split(UNIT);
      return { hash, subject, body };
    });
}

function main(): void {
  const tag = previousTag();
  const commits = commitsSince(tag);
  const breaking = findBreakingCommits(commits);
  const since = tag === undefined ? "the start of history" : tag;

  if (breaking.length === 0) {
    console.log(
      `No breaking change recorded since ${since} — no heads-up required.`,
    );
    return;
  }

  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  const changelog = readFileSync("CHANGELOG.md", "utf8");

  if (!headsUpMissing(changelog, version)) {
    console.log(
      `${breaking.length} breaking change(s) since ${since}; CHANGELOG.md ${version} carries a heads-up.`,
    );
    return;
  }

  console.error(
    [
      `CHANGELOG.md has no heads-up for ${version}, but these commits since ${since} record a breaking change:`,
      "",
      ...breaking.map((c) => `  ${c.hash.slice(0, 8)}  ${c.subject}`),
      "",
      "Users must not meet a disruptive change unannounced. Add a heads-up to",
      `the ${version} entry — one sentence, written for a user, saying what they`,
      "will see and why it is fine. For example:",
      "",
      "  ## " + version,
      "",
      "  > Your icons settle into place once after this update — nothing is lost.",
      "",
      "Write it for users, not from the commit footer, which addresses",
      "contributors. If none of the above is user-visible, say so in the pull",
      "request and remove the breaking marker from the commit.",
    ].join("\n"),
  );
  process.exit(1);
}

main();
