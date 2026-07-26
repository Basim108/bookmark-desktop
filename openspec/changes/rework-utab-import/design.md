# Design — rework-utab-import

> **Status: EXPLORATION NOTES, NOT A SETTLED DESIGN.**
> Captured from an explore-mode session on 2026-07-26. "Open question" entries
> are genuinely unresolved — do not treat a lean as a decision. Entries under
> "Decisions made" ARE settled. Nothing here has been implemented.

## Context

The uTab JSON importer (`src/lib/import/utab.ts`, reached from
`FolderSettingsWindow`) works, but a real-world import of ~1000 entries
surfaced four problems. Sequential (non-batched) creation is **deliberate and
staying** — it avoids flooding Chrome with events and avoids races. Performance
is explicitly out of scope.

Four threads were raised, and two have been split into their own changes:

- **Thread 2 (grid capacity)** → `openspec/changes/place-bookmarks-at-real-grid-capacity/`
  — a placement bug affecting every bookmark-creation path, not an import bug.
- **Thread 4 (import report)** → `openspec/changes/add-utab-import-report/`
  — PROPOSED, all artifacts complete, ready to implement.

**This document is now the exploration home for Threads 1 and 3 only.** The
Thread 4 section below is retained for the reasoning that produced the
proposal; the proposal itself supersedes it.

## Decisions made (2026-07-26)

1. **Report file extension: `.log`.** User chose `.log` over `.csv` with the
   CSV-content mismatch explicitly flagged and accepted. `reportFileName` needs
   an extension parameter (it currently hardcodes `-report.json`).
2. **The report gets a `status` column** (`skipped` | `warning` | `fatal`), so
   one uniformly tabular file covers skips, non-fatal icon failures, and fatal
   errors. The UI's skip count counts only `status=skipped`.
3. **Thread 2 is split** into `place-bookmarks-at-real-grid-capacity`.
4. **Thread 4 (the report) is built first**, before Threads 1 and 3. Rationale:
   several of Thread 1's open questions are empirical (how many of the 783
   skips are scheme-less hosts vs. `chrome://` vs. blank titles), and the
   report answers them permanently and self-service rather than via a one-off
   diagnostic.
5. **CSV/formula-injection escaping is in scope.** Prefix-escape any field
   starting with `=`, `+`, `-`, `@`, tab, or CR, *and* apply RFC 4180 quoting
   for embedded commas, quotes, and newlines. Rationale: titles and URLs come
   from an untrusted file and are rendered for a human in a spreadsheet.
6. **Extend the shared `SkipReason`** (`src/lib/transfer/types.ts:64`) with
   `create-failed` and `icon-failed` rather than forking a uTab-specific type.
   Rationale: one concept, consistent report shape across the extension.
   Accepted cost: couples the two importers.
7. **Report rows cover skips, warnings, and fatals only** — no
   `status=imported` rows. Keeps the file small and actionable.
8. **No report file on whole-file rejection** (`invalid-json` / `not-utab`).
   Nothing was attempted; the existing inline message suffices.

---

## Thread 1 — Blank titles are skipped; "unsafe URL" is over-broad

### Current behaviour

`createBookmark` (`src/lib/bookmarks/create.ts`) rejects with `empty-title`
when the trimmed title is empty, and with `unsafe-url` when
`isSafeNavigationUrl` fails. The importer counts both as `skipped` and drops
the entry.

`src/lib/bookmarks/urlSafety.ts:19` is the entire rule:

```ts
const ALLOWED_NAVIGATION_SCHEMES = new Set(["http:", "https:"]);
isSafeNavigationUrl = (url) => ALLOWED_NAVIGATION_SCHEMES.has(new URL(url).protocol)
```

Deny-by-default. It conflates four distinct categories:

| Category            | Example                        | Why rejected                                                     | Should it be?                             |
| ------------------- | ------------------------------ | ---------------------------------------------------------------- | ----------------------------------------- |
| Genuinely dangerous | `javascript:`, `data:`         | Bookmarklet/XSS vector on a privileged extension page             | **Yes** — the actual security rationale   |
| Deliberately dropped| `file:`, `ftp:`                | See comment `urlSafety.ts:11-17` — Chrome blocks/removed these    | Defensible, but a usability call not safety|
| Browser-internal    | `chrome://extensions`, `about:`| Not on the allowlist                                              | Debatable; uTab users plausibly had these |
| **Not a URL at all**| `google.com`, `www.foo.com/x`  | `new URL("google.com")` **throws** → caught → `false`             | **Probably a bug for import**             |

The last row is the sharpest: a scheme-less host is silently dropped and
counted only in an opaque integer.

### Wanted change

A bookmark with a blank/whitespace-only title should **not** be skipped.
Instead: `title := url`, and its `labelDisplay` set to `"tooltip"` (icon-only,
title on hover).

Mechanism already exists — `BookmarkLabelDisplay = "under-icon" | "tooltip"`
(`storage/schema.ts:37`) and `setBookmarkLabelDisplay`
(`storage/bookmarkSettings.ts:25`). This is composition, not new machinery.

### Open questions

1. **What exactly becomes the title?** Full URL, `URL.hostname`, or hostname
   minus `www.`? Lean: **full URL** — with `tooltip` display it never renders
   on the canvas, and truncating discards the only identifying information the
   entry has. Counter-argument: a full URL reads badly as a hover tooltip.
2. **Change `createBookmark`, or only the importer?** `createBookmark`'s
   `empty-title` rejection deliberately mirrors `updateBookmark`, keeping the
   invariant "an import can never produce a nameless bookmark". Lean: do the
   fallback **in the importer**, preserving the guard for the manual add/edit
   form. Weakening `createBookmark` would silently weaken the edit UI too.
3. **Blank *folder* names?** A folder has no URL to fall back to, so these stay
   skipped. The skip category shrinks but does not disappear.
4. **Should scheme-less URLs be repaired** (`google.com` → `https://google.com`)
   rather than skipped? Not requested, but likely a large share of the 783
   skips.

   **CONFIRMED (2026-07-26, `add-utab-import-report` implemented):** a
   scheme-less url IS skipped, and is reported with reason `unsafe-url` —
   verified in real Chromium by `e2e/import-utab.spec.ts`, which asserts the
   exact report line
   `skipped,b-schemeless,"Reading, Writing",Scheme Less,google.com,unsafe-url,`.
   The cause is that `new URL("google.com")` throws, and `isSafeNavigationUrl`
   catches and returns false — so these entries are indistinguishable in the
   report from a genuine `javascript:` bookmarklet, since both surface as
   `unsafe-url`.

   Two follow-ups this raises for the blank-title change:
   - Consider splitting `unsafe-url` into "unparseable" vs. "disallowed
     scheme" so the report can tell a recoverable `google.com` apart from a
     deliberately blocked `javascript:`. Without that split the report cannot
     answer the question this thread is actually asking.
   - The *share* of the user's 783 skips in each category still requires
     running the report against their real export — the mechanism now exists,
     but the measurement has not been taken.
5. **Should any of the other rejected categories be relaxed for import**
   (`chrome://`, `file:`)? Currently unexamined.

---

## Thread 2 — Import fills only 24 cells (SPLIT OUT)

**Moved to `openspec/changes/place-bookmarks-at-real-grid-capacity/design.md`.**

Summary for context only: the service worker places every new bookmark against
the hardcoded `DEFAULT_GRID_CAPACITY` of 6x4 (`grid/placement.ts:8`, used at
`bookmarks/events.ts:30` and `:135`), while the page renders at the real
measured capacity (~9x5). Item #24 therefore lands on page 2. It is a
placement bug on every creation path, not an import bug — hence the split.

**Coupling to keep in mind:** Thread 3 (root-folder import button) makes
imports easier, so it makes this bug hit more often. Shipping Thread 3 without
the capacity fix makes the bug *more* visible, not less.

---

## Thread 3 — No import entry point for root folders

### Current behaviour

`src/newtab/components/FolderTreeNode.tsx:147`:

```jsx
{!isRoot && (
  <button className="folder-settings-toggle" aria-label="Folder settings">gear</button>
)}
```

Root rows (Bookmarks bar / Other bookmarks / Mobile bookmarks) get the `+`
"Add subfolder" button (`:133`, unconditional) but **not** the gear. The import
button lives inside the gear window and is gated again on `{folder && …}` at
`FolderSettingsWindow.tsx:366`. Net effect: importing into a root requires
creating a throwaway subfolder first.

```
  ROOT ROW                          NON-ROOT ROW
  +-----------------------+         +-----------------------+
  | > Bookmarks bar     + |         | > uTab            + @ |
  +-----------------------+         +------------------+----+
        no gear -> no import                           |
                                                       v
     wanted:  [import] [+]                    +----------------------+
              ^ new button, before +          | Folder Settings      |
                                              |  icon / name         |
                                              |  [Import uTab...] <--+-- only path today
                                              +----------------------+
```

The `!isRoot` guard is well-motivated: Chrome refuses `bookmarks.update` on
root folders, so rename and the icon field are meaningless there. Adding import
as a **sibling button** rather than un-gating the settings window respects
that — it exposes the one operation that *is* valid on a root without the two
that are not.

### Wanted change

An additional button that triggers uTab import, placed immediately **before**
the `+` / "Add a folder" button, available on root folder rows.

### Open questions

1. **Where does progress and the summary render?** Today the dialog shows
   "Importing…" and then the summary. A bare toolbar button has no such
   surface. Options: (a) a small dedicated Import window reusing the dialog
   chrome minus icon/name fields; (b) a transient toast on the sidebar row.
   Lean: **(a)** — it matches every other operation in this app, and a
   multi-second job with a multi-part result deserves a real surface. Thread 4
   strengthens this: the summary must also name the report file.
2. **Root-only, or every row?** A standalone button on all rows would give
   non-root folders two import entry points (button + inside gear). Do we put
   the button everywhere and remove the gear entry — one consistent
   affordance — or keep it root-only and accept the asymmetry?
3. **Icon and ordering.** Requested order is `[import] [+] [gear]`. Needs a
   visual check: `+` and gear are currently a stable pair at the row's right
   edge.
4. **Confirmation step?** Roots are where a mistaken import is most annoying to
   undo (many subfolders scattered into the bookmarks bar). Does this want an
   "Import into **Bookmarks bar**?" confirmation that the in-settings flow does
   not need, because there the target is obvious from context?

---

## Thread 4 — Downloadable per-entry import report

### Wanted change

On import, in addition to the inline summary ("Imported 12 folders, 213
bookmarks — skipped 783"), write a report file named
`<imported file name>-report.log` with a header line and one row per skipped
bookmark. Requested columns:

```
id, folder, bookmark-title, bookmark-url, skipping-reason, error
```

`id` is the uTab `_id`. Errors occurring during the import must also be written
into the file.

### Strong existing precedent — reuse, do not reinvent

The state-transfer import already solves this exact problem:

- `src/lib/transfer/download.ts:6` — `downloadJson(data, filename)` via a
  transient object-URL anchor. **No `chrome.downloads` permission needed**;
  the file is produced and saved entirely in-page, nothing leaves the device.
- `src/lib/transfer/download.ts:42` — `reportFileName("x.json")` →
  `"x-report.json"` (strips the last extension; a dotless name is used as-is).
- `src/lib/transfer/types.ts:64` — an established vocabulary:
  ```ts
  type SkipReason = "empty-title" | "unsafe-url" | "parent-skipped" | "root-unavailable";
  interface SkippedEntryRecord { absoluteFolderPath; name; url: string | null; reason }
  ```
- `GeneralSettingsWindow.tsx:150-156` — downloads the report, then shows a
  summary naming the file and waits for acknowledgement before reloading
  (a reload would erase the message).

So this is largely **generalizing three existing pieces**, which supports the
premise that Thread 4 simplifies the others.

### How it simplifies the other threads

- **Thread 1** — the report *is* the itemization. The inline summary can stay a
  single number; detail moves to the file. This retires the "should `skipped`
  be itemized?" question entirely. It also makes Thread 1's open questions
  **empirically answerable**: run the import, read the file, see whether the
  783 skips are scheme-less hosts, `chrome://` URLs, blank titles, or genuine
  `javascript:` bookmarklets.
- **Thread 3** — gives the new root-import dialog a concrete job: show the
  count and name the report file, mirroring `GeneralSettingsWindow`.
- **Thread 2** — helps least. Placement happens in the service worker *after*
  the importer returns, so the report cannot observe placement outcomes at all.
  Worth stating plainly rather than implying the report covers everything.

### Defect this uncovered — the importer has no error handling at all

```js
// GeneralSettingsWindow.tsx:138           // FolderSettingsWindow.tsx:175
try {                                      setImporting(true);
  const text = await file.text();          const text = await file.text();
  const result = await importState(...);   const result = await importUtabExport(...);
  ...                                      setImporting(false);   // never runs on throw
} catch { ... }                            // NO try/catch, NO finally
```

`importUtabExport` awaits `chrome.bookmarks.create` (rejects on quota, or on a
URL Chrome itself refuses) and `putIcon` (rejects on IndexedDB quota — very
live when importing hundreds of base64 icons). Nothing in the chain catches
either. **Today a mid-import failure leaves the dialog stuck on "Importing…"
forever, with no message and no report.**

This forces a structural requirement: the report must be **accumulated
incrementally and emitted from a `finally`**, not assembled and returned at the
end — otherwise the one case most needing a log (the crash) produces none.

```
  rows: ReportRow[] = []
  try {
      for each folder / bookmark ...
          rows.push(...) on every skip or warning
  } catch (e) {
      rows.push({ status: "fatal", error: String(e) })   // partial import still reports
  } finally {
      if (rows.length) downloadCsv(rows, reportFileName(file.name))
  }
```

### Open questions and pushback

1. **[RESOLVED — in scope]** CSV/formula injection escaping. Titles and URLs come from
   an untrusted file and land in a spreadsheet. An entry titled
   `=HYPERLINK("http://evil","click")` or `+cmd|'/c calc'!A1` executes on open
   in Excel. Every field needs a leading `'` (or tab) prefix when it begins
   with `=`, `+`, `-`, `@`, tab, or CR — **plus** RFC 4180 quoting for embedded
   commas, quotes, and newlines. The entire purpose of this file is "untrusted
   input rendered for a human", so this is squarely in scope.
2. **[RESOLVED — `.log`]** The file holds CSV content but is named `.log`, so
   double-clicking opens a text editor and no tool auto-parses it as CSV. This
   trade-off was flagged and the user chose `.log` anyway. `reportFileName`
   hardcodes `-report.json` and needs an extension parameter.
3. **`_id` is currently discarded on purpose.** `utab.ts:11-13` states: "uTab
   also emits `_id`, `id`, and a remote `icon` URL per bookmark; those are
   intentionally ignored." Column 1 reverses that. Fine, but the comment must
   be updated rather than quietly contradicted. `_id` is untrusted `unknown` —
   needs coercion, and may be absent.
4. **The column set has a gap.** The proposed columns imply every row is a
   skip, but two other things want logging:
   - **Icon failures** — the bookmark imported *fine*; only its `preview`
     failed to decode or validate. A warning, not a skip. Currently swallowed
     silently at `utab.ts:77-81`.
   - **Fatal errors** — no `folder`/`title`/`url` exists to report.
   
   **[RESOLVED — add the column]** A **`status`** column
   (`skipped` | `warning` | `fatal`) so one uniformly tabular file covers all
   three, with the UI's skip count counting only `status=skipped`. The
   alternative (skipped-only rows plus a trailing free-text error line) was
   rejected because it breaks the tabular shape.

   Final column order therefore becomes:
   `status, id, folder, bookmark-title, bookmark-url, skipping-reason, error`
   — placement of `status` first vs. last is still open.
5. **`folder` for orphaned bookmarks.** When a folder is dropped for a blank
   name its bookmarks go with it (`utab.ts:120-123`). Those rows have no folder
   name to print — the blankness is *why* it failed. Print empty with reason
   `parent-skipped`, matching the existing `SkipReason` vocabulary?
6. **[RESOLVED — extend]** Extend the shared `SkipReason`
   (`src/lib/transfer/types.ts:64`) with `create-failed` and `icon-failed`.
   Rejected alternative: a parallel uTab-specific type. Accepted cost: the two
   importers are now coupled and must be changed together.
7. **[RESOLVED — no successes]** Rows cover skips, warnings, and fatals only.
   A full `status=imported` audit trail was considered and rejected as too
   noisy.
8. **Divergent report formats.** State transfer writes **JSON**; this writes
   **CSV**. Intentional (CSV is far better for eyeballing 783 rows), but record
   the rationale so a later reader does not "fix" the inconsistency.
9. **[RESOLVED — no file]** `invalid-json` / `not-utab` produce no report;
   nothing was attempted and the inline message suffices.

---

## Scoping and sequencing — SETTLED

```
   Thread 4 (report)       ---- BUILD FIRST; enables/simplifies 1 and 3
        |
        +--> Thread 1 (blank titles)  contained: utab.ts + spec
        |
        +--> Thread 3 (root entry)    UI; couples to the capacity change

   Thread 2 (capacity)  ---- SPLIT OUT into its own change:
                             openspec/changes/place-bookmarks-at-real-grid-capacity/
```

Thread 2 was split because it is a placement bug affecting every creation path
(Chrome-star bookmarking, sync-created bookmarks), touching the service worker,
the storage schema, and the grid specs — not an import bug.

Threads 2 and 3 remain coupled: a root-folder entry point means more imports,
and every one hits the 6x4 placement bug. **Shipping Thread 3 without the
capacity change makes that bug more visible, not less.** Still to decide: does
Thread 3 ship before, with, or after `place-bookmarks-at-real-grid-capacity`?

---

## Specs likely affected

- `openspec/specs/bookmark-import/spec.md`
  - "Skip-and-Report of Invalid Entries" — blank title stops being a skip
    reason (Thread 1); summary gains a report file (Thread 4).
  - New requirement for the report file (Thread 4).
- `openspec/specs/folder-sidebar/spec.md` — root-row import button (Thread 3).

(`bookmark-canvas` and the "importer does not write positions itself" line are
handled by `place-bookmarks-at-real-grid-capacity`.)

## Immediate next step

Write the proposal for Thread 4 (the report) — the first unit of work. All of
its blocking questions are now resolved; only open question 5 (what to print in
the `folder` column for bookmarks orphaned by a skipped folder — proposed:
empty, with reason `parent-skipped`) and the `status` column's position in the
header remain, and both are safe to settle while drafting.

Once the report ships, run it against the user's real uTab JSON to settle
Thread 1's empirical open questions (scheme-less URLs, `chrome://`, the true
blank-title share of the 783 skips).
