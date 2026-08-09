/**
 * One released version's user-facing notes, as structured content rather than
 * markdown text.
 *
 * Structured rather than raw markdown for two reasons. The project forbids raw
 * HTML injection and gates it in CI, so rendering markdown would mean adding a
 * renderer and a sanitizer for what is fundamentally a bulleted list. And a
 * bullet array has an obvious length to check, where free-form markdown does
 * not — concision stays enforceable.
 */
export interface ReleaseEntry {
  version: string;
  /** Present only when the entry declares one; rendered ahead of the changes. */
  headsUp?: string | undefined;
  /** User-facing changes, one line of prose each. Never empty. */
  changes: string[];
  /** The closing sentence rolling up bug fixes, when the entry has one. */
  fixesNote?: string | undefined;
}

/** `## 1.1.0` — a version heading, capturing the version it names. */
const VERSION_HEADING = /^##\s+(\S+)\s*$/;

/** `- A change`, opening a new bullet rather than continuing the previous one. */
const BULLET = /^-\s+(.*)$/;

/** `> A heads-up`, one line of the entry's blockquote. */
const QUOTE = /^>\s?(.*)$/;

/** Rejoins a wrapped run of lines into the single line of prose it was authored as. */
function unwrap(lines: string[]): string {
  return lines.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Extracts one version's entry from the user-facing changelog.
 *
 * Throws rather than returning a partial entry: the sole callers are the build
 * guard, which must fail the build, and the module that bakes the entry into
 * the bundle, which must not produce a notice window that opens empty.
 */
export function parseReleaseEntry(
  changelog: string,
  version: string,
): ReleaseEntry {
  const lines = changelog.split("\n");

  const start = lines.findIndex(
    (line) => VERSION_HEADING.exec(line)?.[1] === version,
  );
  if (start === -1) {
    throw new Error(`The changelog has no entry for version ${version}.`);
  }

  const rest = lines.slice(start + 1);
  const nextHeading = rest.findIndex((line) => VERSION_HEADING.test(line));
  const section = nextHeading === -1 ? rest : rest.slice(0, nextHeading);

  const quoted: string[] = [];
  const changes: string[][] = [];
  const trailing: string[] = [];

  for (const line of section) {
    const quote = QUOTE.exec(line);
    if (quote) {
      quoted.push(quote[1] ?? "");
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet) {
      changes.push([bullet[1] ?? ""]);
      continue;
    }

    if (line.trim() === "") continue;

    // An indented line under a bullet continues it; anything else at the left
    // margin, once the bullets are done, is the closing fixes sentence.
    const current = changes.at(-1);
    if (current && /^\s/.test(line)) {
      current.push(line.trim());
      continue;
    }
    trailing.push(line.trim());
  }

  if (changes.length === 0) {
    throw new Error(
      `The changelog entry for version ${version} lists no changes.`,
    );
  }

  const headsUp = unwrap(quoted);
  const fixesNote = unwrap(trailing);
  return {
    version,
    ...(headsUp === "" ? {} : { headsUp }),
    changes: changes.map(unwrap),
    ...(fixesNote === "" ? {} : { fixesNote }),
  };
}
