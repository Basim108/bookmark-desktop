# Design — ignore-utab-empty-slots

## The evidence

`design/examples/uTab_settings_26-07-2026-report.log`, produced by a real
import of the user's uTab export. 789 rows, parsed as CSV:

```
status × reason
  783  skipped  empty-title
    6  warning  icon-failed
    0  skipped  unsafe-url
    0  fatal    —

column population across all 789 rows
  folder   789      id        31
  url       31      title      6      error  0
```

Two facts fall out immediately.

**Zero `unsafe-url` skips.** Thread 1 of `rework-utab-import` devotes most of
its length to `isSafeNavigationUrl` being over-broad — scheme-less hosts,
`chrome://`, `file:` — and names a split of `unsafe-url` into "unparseable" vs
"disallowed scheme" as a prerequisite for measuring the problem. The report
answered by returning the empty set. That whole line of work has no support in
this data.

**758 rows have no url, no title, and no `_id`.** Only 31 rows carry a url at
all: 25 skips and the 6 icon warnings.

## Why the 758 are empty slots

Per-folder skip counts, and what each implies was created if every folder holds
exactly 83 entries:

```
  folder                skipped   83−skipped
  Mentoring                  81            2
  GE                         81            2
  Social                     80            3
  Games                      79            4
  Distributed Systems        76            7
  Yoga                       75            8
  Ian                        74            9
  EngX                       70           13
  Event Analytics            67           16
  NZ                         46           37
  Hrimsoft                   36           47
  Education                  18           65
                        -------      -------
                            783          213   ← matches the reported count exactly
```

12 × 83 = 996 = 213 + 783. The implied per-folder created counts are all
non-negative and all plausible for a bookmarks page.

**CONFIRMED against the source JSON (2026-07-26).** `folders[].bookmarks.length`
is **83 for all 12 folders**, 996 entries total, of which 758 have no usable
url. The inference above was not a coincidence of sums:

```
  folder                len  no-url  real        folder               len  no-url  real
  NZ                     83      46    37        Hrimsoft              83      29    54
  Ian                    83      74     9        Event Analytics       83      65    18
  Education              83      14    69        Mentoring             83      80     3
  EngX                   83      68    15        Yoga                  83      75     8
  Distributed Systems    83      76     7        GE                    83      81     2
  Social                 83      71    12        Games                 83      79     4
                                                 TOTAL                996     758   238
```

The 238 real entries reconcile exactly with the report: 238 − 25 blank-titled
(skipped as `empty-title`, the losses Thread 1 rescues) = the 213 bookmarks the
summary said it created.

## Measured outcome

Running the implemented importer against the real export
(`design/examples/uTab_settings_26-07-2026.json`) reproduces the original import
exactly — same 12 folders, same 213 bookmarks, same 6 `icon-failed` warnings —
with the noise gone:

| | before | after |
| --- | ---: | ---: |
| skipped (summary) | 783 | **25** |
| report rows | 789 | **31** |
| `skipped` / `empty-title` | 783 | 25 |
| `warning` / `icon-failed` | 6 | 6 |

The 25 that remain are exactly the blank-titled bookmarks with real urls —
the scope of `import-blank-named-utab-entries`, and nothing else.

## The predicate — empty url

```
  entry.url  absent / non-string / "" / whitespace-only
      │
      ├── yes ──▶ empty slot: no create, no count, no row
      └── no  ──▶ existing path: createBookmark, and report if it rejects
```

**Decided: the empty url alone is sufficient.** Title and `_id` are not
consulted.

The alternative considered was `!url && !title` (and a stricter
`!url && !title && !_id`), which would preserve reporting for a hypothetical
entry that has a title but no url. Rejected:

- No such entry exists in the observed export. All 758 url-less rows are also
  title-less and id-less; the three predicates select exactly the same 758 rows
  against real data.
- A bookmark with no url is not a bookmark under any reading. There is no
  `createBookmark` outcome that could succeed for it, and no user action that
  could recover it, so a report row for it is unactionable either way.
- One clause is a rule that can be stated in a sentence and checked at a
  glance. Three clauses invite the next reader to ask which one is load-bearing.

**Accepted consequence:** if a future uTab version emits a title-bearing,
url-less entry — a note or widget cell, say — it is dropped with no trace. This
is a real behavioural gap, recorded here deliberately rather than discovered
later. The mitigation if it ever matters is to add the `!title` clause back;
nothing about this change forecloses that.

## Where the guard goes

Two call sites in `src/lib/import/utab.ts`, and both matter:

```
  importUtabExport
    │
    for each folder
      │
      ├── createFolder fails ──▶ for each bookmark:  push parent-skipped row
      │                            ^^^^ guard here too — a blank-named folder
      │                                 would otherwise emit ~83 noise rows
      │
      └── createFolder ok ─────▶ for each bookmark:  createBookmark
                                   ^^^^ guard here — the main path, 758 rows
```

The orphan loop (`utab.ts:161`) is easy to overlook because the observed export
never hit it: all 12 folders imported. But a single blank-named folder in some
other export would put the entire noise problem straight back into the report.

**Known expiry date on that second guard.** Thread 1 of `rework-utab-import`
has since settled on substituting `"New Folder"` for a blank folder name
instead of skipping the folder. `createFolder` (`create.ts:20`) can only return
`ok: false` with `empty-title` — that is its sole `BookmarkCreateError` — so
once the importer stops passing it blank names, this whole failure branch
becomes unreachable and takes the orphan guard with it. That change lands
*after* this one, so the guard is still required here and the sequencing is not
wasted work; but whoever implements Thread 1 should delete the branch
deliberately rather than leave dead code behind. Noted in both designs.

## What this does not touch

- **A present-but-unsafe url still skips and reports.** `javascript:`, `data:`,
  and a scheme-less `google.com` all remain `skipped` / `unsafe-url`. The guard
  tests for absence, not validity. `e2e/import-utab.spec.ts:151` already
  asserts the scheme-less case and must keep passing unchanged — it is the
  boundary marker for this change.
- **Blank-titled bookmarks that have a url.** Those are the 25 real losses and
  belong to Thread 1.
- **Folder entries.** A folder has no url; the predicate cannot express an
  empty folder slot, and none were observed.

## Relationship to the other import work

```
  ignore-utab-empty-slots   ──▶ removes 758/783 of the noise
        │                        "skipped 783" → "skipped 25"
        │
        └──▶ Thread 1 (title := url + tooltip)
                 scope confirmed: 25 entries, all well-formed https
                 Q1 resolved by the data: full URL, not hostname —
                   two Hrimsoft entries share hrimsoft.atlassian.net and
                   differ only by path, so hostname would collide
                 Q4/Q5 (scheme repair, chrome:// relaxation) unsupported
                 the unsafe-url reason split is no longer a prerequisite
```

Landing this first makes Thread 1's effect legible: after it, the report should
contain almost exactly the entries Thread 1 rescues, so the before/after is a
direct read rather than a subtraction.

## Also exposed by the same report, not fixed here

- **`error` is empty on all 6 `icon-failed` rows.** `attachPreviewIcon`
  (`utab.ts:83-96`) collapses three distinct failures — `dataUrlToBlob`
  returning null, `validateIconFile` rejecting on format sniff, rejecting on
  the size cap — into a bare `false`. The column exists and is filled only by
  the `fatal` path, so the user is told an icon failed but never why.
- **`_id` is not an opaque key.** Three warning rows carry
  `id=https://www.amazon.com/`, `id=https://www.youtube.com/`,
  `id=https://www.netflix.com/` — uTab's seeded default bookmarks use their url
  as `_id`. Harmless (`asId` passes any non-empty string through), but worth
  knowing before anything treats that column as an identifier. `_id` also
  repeats across folders: `lEt1g9gkJ7zLNX` (Clockify) appears under both
  Education and Event Analytics.
