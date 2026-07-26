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
  — **IMPLEMENTED and archived** as
  `openspec/changes/archive/2026-07-26-add-utab-import-report/`.

**This document is now the exploration home for Threads 1 and 3 only.** The
Thread 4 section below is retained for the reasoning that produced the
proposal; the proposal itself supersedes it.

A fifth change was created **after** the report shipped and was read:

- **`openspec/changes/ignore-utab-empty-slots/`** — 758 of the 783 skips turned
  out not to be bookmarks at all. See "The measurement" below; it reshapes
  Thread 1 substantially.

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

### After the report shipped and was measured (still 2026-07-26)

9. **Empty uTab slots are ignored entirely** — split into
   `openspec/changes/ignore-utab-empty-slots/`. An entry with no url is a
   placeholder, not a failed import: not created, not counted, not reported.
   758 of the 783 skips were these.
10. **The `unsafe-url` work is dropped** — scheme-less repair, `chrome://` /
    `file:` relaxation, and the proposed `unsafe-url` reason split. The
    measurement found zero `unsafe-url` skips, so there is no measured benefit
    to weigh against relaxing a security allowlist. See Thread 1, questions 4
    and 5.
11. **A blank folder name becomes `"New Folder"`** rather than skipping the
    folder and its whole subtree. See Thread 1, question 3.
12. **Both fallbacks live in the importer**, not in `createBookmark` /
    `createFolder`. Those guards also serve the manual add/edit forms and stay
    as they are. See Thread 1, question 2.

---

## Thread 1 — Blank titles are skipped; "unsafe URL" is over-broad

> **SPLIT OUT → `openspec/changes/import-blank-named-utab-entries/`** —
> PROPOSED, all artifacts complete. Every open question below is resolved or
> dropped. This section is retained for the reasoning that produced the
> proposal; the proposal supersedes it. Questions 6 and 7 (added after the
> measurement) are **not** covered by it and remain unclaimed.

### The measurement — SETTLED (2026-07-26)

The report shipped and was run against the user's real export
(`design/examples/uTab_settings_26-07-2026-report.log`, 789 rows). This is the
empirical answer the whole thread was waiting on, and it **overturns the
thread's premise**.

```
789 rows
├─ 783  status=skipped   reason=empty-title    ← 100% of skips
└─   6  status=warning   reason=icon-failed
        reason=unsafe-url: NONE    status=fatal: none    error column: never populated
```

**Zero `unsafe-url` skips.** Everything below about `isSafeNavigationUrl` being
over-broad — scheme-less hosts, `chrome://`, `file:` — has no support in this
data. The proposed split of `unsafe-url` into "unparseable" vs "disallowed
scheme", named earlier in this document as a prerequisite for measuring the
problem, is not needed: the report answered by returning the empty set.

**The 783 split cleanly in two**, and the larger half is not a loss at all:

| | rows | shape | verdict |
| --- | ---: | --- | --- |
| empty uTab grid slots | 758 | no `url`, no `title`, no `_id` | never were bookmarks |
| genuine losses | 25 | has `url`, blank `title` | **exactly what this thread rescues** |

The 758 are placeholder elements in uTab's fixed-size per-folder `bookmarks`
arrays. 12 folders × 83 slots = 996 = 213 created + 783 skipped, exactly, with
every folder's implied created count non-negative and plausible. Split out into
**`openspec/changes/ignore-utab-empty-slots/`**, which carries the full
arithmetic.

**So Thread 1's real scope is 25 bookmarks, not 783** — a factor of 31 smaller
than the number that motivated it. Still worth doing: they are useful, live
entries (`github.com/Basim108`, two Jira/Confluence deep links, LinkedIn,
Instagram, Logtail, Clockify), all well-formed `https://`.

**The fallback is safe against the 758.** They have no url either, so
`title := url` yields nothing and they would stay skipped — there is no risk of
this change resurrecting 758 junk bookmarks. `ignore-utab-empty-slots` removes
them for a different reason (they are noise in the report and in the count),
and the two changes do not conflict.

**Sequencing:** land `ignore-utab-empty-slots` first. With the noise gone the
report shrinks to almost exactly the entries this thread rescues, so Thread 1's
effect becomes a direct before/after read rather than a subtraction.

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

The last row looked like the sharpest: a scheme-less host is silently dropped
and counted only in an opaque integer.

**Superseded by the measurement above.** The user's export produced *zero*
`unsafe-url` skips of any kind, so none of these four categories actually
occurred. The analysis stands as a description of the rule; it is no longer a
description of a problem anyone has. Keep it for the day a different export
does hit it.

### Wanted change

A bookmark with a blank/whitespace-only title should **not** be skipped.
Instead: `title := url`, and its `labelDisplay` set to `"tooltip"` (icon-only,
title on hover).

A **folder** with a blank/whitespace-only name should not be skipped either.
Instead: `name := "New Folder"`, keeping its bookmarks with it. See open
question 3 — this is settled.

Both are the same shape of fix, and open question 2 is now settled for both:
**the substitution happens in the importer**, before `createBookmark` /
`createFolder` are called. Their guards are left untouched.

```
  utab.ts, per bookmark entry
    │
    ├─ no url ────────────────▶ empty slot: ignore  (ignore-utab-empty-slots)
    │
    ├─ blank title ───────────▶ title := url
    │                           labelDisplay := "tooltip"
    │
    └─ createBookmark(folderId, title, url)     ← guard unchanged, now never
                                                  rejects for empty-title

  utab.ts, per folder
    │
    ├─ blank name ────────────▶ name := "New Folder"
    │
    └─ createFolder(targetId, name)             ← guard unchanged, now never
                                                  rejects at all
```

Order matters: the empty-slot check must precede the title fallback, or every
placeholder gets `title := ""` and 758 junk bookmarks get created.

Mechanism already exists — `BookmarkLabelDisplay = "under-icon" | "tooltip"`
(`storage/schema.ts:37`) and `setBookmarkLabelDisplay`
(`storage/bookmarkSettings.ts:25`). This is composition, not new machinery.

Measured scope: **25 entries** in the user's export (see "The measurement").
A blank title with *no* url is an empty grid slot, not a rescuable bookmark, and
is handled by `ignore-utab-empty-slots` — the fallback here applies only where a
url exists.

### Open questions

1. **What exactly becomes the title?** Full URL, `URL.hostname`, or hostname
   minus `www.`?

   **RESOLVED — full URL (2026-07-26, by the data).** Two of the 25 rescuable
   entries are `https://hrimsoft.atlassian.net/jira/software/projects/HC/boards/1`
   and `https://hrimsoft.atlassian.net/wiki/spaces/HRIMCALEND/pages/65566/Syst…`
   — same host, different paths. A hostname title would render them
   indistinguishable, which is precisely the failure the fallback exists to
   prevent. This confirms the earlier lean rather than merely agreeing with it.
   The counter-argument (a full URL reads badly as a hover tooltip) is accepted
   as the lesser cost: an ugly tooltip beats two identical ones.
2. **Change `createBookmark`/`createFolder`, or only the importer?**

   **RESOLVED — in the importer (2026-07-26, user decision).** Both
   substitutions (`title := url` for bookmarks, `name := "New Folder"` for
   folders) happen in `src/lib/import/utab.ts` before it calls the creation
   functions. `createBookmark` and `createFolder` keep their `empty-title`
   guards exactly as they are.

   Rationale: those guards deliberately mirror `updateBookmark` and
   `updateFolderTitle`, and they serve the manual add/edit forms as well as the
   importer. An empty name in the New Folder dialog should stay rejected so the
   user types one — it should not quietly become `"New Folder"`. Relaxing a
   shared guard to serve one caller would change behaviour in a UI nobody asked
   to change.

   Consequences for implementation:

   - `empty-title` becomes **unreachable from the uTab importer** on both the
     folder and the bookmark path. It stays in the shared `SkipReason` union
     for state-transfer, and the note added by `add-utab-import-report`
     (tasks 2.2) predicting exactly this should be updated from "goes dead once
     the blank-title fallback lands" to a statement of fact.
   - `reasonForCreateError` (`utab.ts:112`) maps `empty-title` → `empty-title`
     and everything else → `unsafe-url`. With `empty-title` unreachable, that
     function collapses to always returning `unsafe-url`. Simplify it or keep
     it total and defensive — but decide, do not leave a branch that can no
     longer be taken looking live.
   - The importer's own guards must run in a defined order against the empty
     slot rule from `ignore-utab-empty-slots`: **empty slot first** (no url →
     ignore entirely), *then* the title fallback. Reversing them would give
     every empty slot a title of `""` and create 758 junk bookmarks.
3. **Blank *folder* names?**

   **RESOLVED — default to `"New Folder"` (2026-07-26, user decision).** A
   folder has no url to fall back to, but unlike a bookmark it does not need
   one: a folder with no name is still a container holding real bookmarks, and
   dropping it drops its whole subtree. An import SHALL substitute the literal
   `"New Folder"` for an empty or whitespace-only folder name rather than
   skipping the folder.

   `"New Folder"` is already this app's vocabulary for an unnamed folder — it
   is the heading of the create-folder draft window
   (`FolderSettingsWindow.tsx:330`), so the name a user sees on the canvas
   matches the one they'd have seen in the dialog.

   Two consequences worth stating:

   - **Duplicates are possible and accepted.** An export with three blank
     folder names produces three folders called `"New Folder"`. Chrome permits
     duplicate sibling names, and the existing "Import Always Creates New
     Items" requirement already establishes that import never de-duplicates.
   - **This makes the `parent-skipped` path unreachable for uTab.**
     `createFolder` (`create.ts:20`) can only return `ok: false` with
     `empty-title` — that is the sole `BookmarkCreateError` it produces. Once
     the importer never passes it a blank name, its failure branch
     (`utab.ts:151-173`) and every `parent-skipped` row with it become dead
     code. A `chrome.bookmarks.create` rejection still goes to the `fatal`
     path, not here. `parent-skipped` stays in the shared `SkipReason` union
     because state-transfer still emits it. Decide at implementation time
     whether to delete the branch or keep it defensively — but do not leave it
     undocumented, because a reader will otherwise assume it still fires.

   Not exercised by the observed export: all 12 folders imported successfully
   and there were zero `parent-skipped` rows, so this fixes a case the user has
   not actually hit yet.
4. **Should scheme-less URLs be repaired** (`google.com` → `https://google.com`)
   rather than skipped?

   **DROPPED (2026-07-26).** The mechanism was confirmed — a scheme-less url is
   skipped as `unsafe-url` because `new URL("google.com")` throws and
   `isSafeNavigationUrl` catches it, verified in real Chromium by
   `e2e/import-utab.spec.ts:151`. But the *incidence* is now measured at
   **zero**: the user's export produced no `unsafe-url` skips at all. The
   earlier guess that these were "likely a large share of the 783 skips" was
   wrong; the 783 were empty grid slots.

   Consequently the proposed split of `unsafe-url` into "unparseable" vs
   "disallowed scheme" is also dropped. It was justified solely as the
   instrument for taking this measurement, and the measurement came back empty
   without it. Revisit only if a future export shows real `unsafe-url` skips.
5. **Should any of the other rejected categories be relaxed for import**
   (`chrome://`, `file:`)?

   **DROPPED — same reason.** Zero occurrences. Relaxing a security allowlist
   is a real cost; there is now no measured benefit on the other side of it.

### New, from the same report

6. **The `error` column is empty on all 6 `icon-failed` rows.**
   `attachPreviewIcon` (`utab.ts:83-96`) collapses three distinct failures —
   `dataUrlToBlob` returning null, `validateIconFile` rejecting on the format
   sniff, rejecting on the size cap — into a bare `false`. The report has an
   `error` column that only the `fatal` path ever fills, so the user is told an
   icon failed but never why. Small, independent, unclaimed by any change yet.
7. **`_id` is not an opaque key.** Three warning rows carry
   `id=https://www.amazon.com/`, `id=https://www.youtube.com/`,
   `id=https://www.netflix.com/` — uTab's seeded default bookmarks use their
   url as `_id`. Harmless today (`asId` passes any non-empty string through),
   but worth knowing before anything treats that column as an identifier. `_id`
   also repeats across folders: `lEt1g9gkJ7zLNX` (Clockify) appears under both
   Education and Event Analytics, so it is not even unique within one export.

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
   Thread 4 (report)  ---- DONE, archived 2026-07-26
        |
        |  its output reshaped everything downstream:
        v
   ignore-utab-empty-slots  ---- NEXT; removes 758 of the 783 "skips"
        |                         "skipped 783" -> "skipped 25"
        v
   Thread 1 (blank titles)  ---- contained: utab.ts + spec; scope now 25 entries
                                 the unsafe-url work under it is DROPPED (zero
                                 occurrences measured)

   Thread 3 (root entry)    ---- UI; couples to the capacity change

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

~~Write the proposal for Thread 4 (the report).~~ **Done** — implemented and
archived 2026-07-26.

~~Run it against the user's real uTab JSON to settle Thread 1's empirical open
questions.~~ **Done** — see "The measurement" under Thread 1. Result: zero
`unsafe-url` skips, 758 of the 783 skips were empty uTab grid slots, and 25 were
genuine blank-titled bookmarks.

Next: implement **`openspec/changes/ignore-utab-empty-slots/`** (proposed, all
artifacts complete).

**Thread 1 is split out into
`openspec/changes/import-blank-named-utab-entries/`** — PROPOSED, all artifacts
complete. All five of its open questions are resolved or dropped: full-URL
title (Q1), importer-side substitution (Q2), `"New Folder"` for blank folder
names (Q3), `unsafe-url` work dropped (Q4, Q5). Scope: the 25 measured entries
plus the folder default.

Still unclaimed by any change: questions 6 and 7 — the empty `error` column on
`icon-failed` rows, and `_id` not being an opaque key. Question 6 is a real
diagnostic gap and should be picked up by something.

Also still open: Thread 3 (root-folder import entry point) on its own four
questions, and its sequencing against `place-bookmarks-at-real-grid-capacity`.

Thread 3 (root-folder import entry point) is untouched by the measurement and
remains open on its own four questions; its sequencing against
`place-bookmarks-at-real-grid-capacity` is still the real decision there.
