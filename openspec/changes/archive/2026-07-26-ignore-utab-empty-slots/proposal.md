## Why

The import report shipped by `add-utab-import-report` was run against a real
uTab export (`design/examples/uTab_settings_26-07-2026-report.log`). It
disproves the premise the remaining import work was built on.

```
789 rows
├─ 783  status=skipped   reason=empty-title    ← 100% of skips
└─   6  status=warning   reason=icon-failed
        reason=unsafe-url: none    status=fatal: none    error column: never populated
```

The 783 skips split cleanly in two:

| | rows | shape |
| --- | ---: | --- |
| **not bookmarks at all** | 758 | no `url`, no `title`, no `_id` |
| **genuine losses** | 25 | has `url`, blank `title` |

The 758 are empty slots in uTab's fixed-size per-folder arrays, and the
arithmetic is exact: 12 folders × 83 slots = 996 entries = 213 created + 783
skipped, with every folder's implied created count landing non-negative and
plausible.

| folder | skipped | implied created | | folder | skipped | implied created |
| --- | ---: | ---: | --- | --- | ---: | ---: |
| Mentoring | 81 | 2 | | EngX | 70 | 13 |
| GE | 81 | 2 | | Event Analytics | 67 | 16 |
| Social | 80 | 3 | | NZ | 46 | 37 |
| Games | 79 | 4 | | Hrimsoft | 36 | 47 |
| Distributed Systems | 76 | 7 | | Education | 18 | 65 |
| Yoga | 75 | 8 | | **total** | **783** | **213** |
| Ian | 74 | 9 | | | | |

The importer walks `folder.bookmarks` unconditionally
(`src/lib/import/utab.ts:190`), calls `createBookmark(folderId, "", "")` on
every placeholder, and dutifully records the rejection. So:

- The summary **"skipped 783" overstates the real loss by a factor of 31.** It
  reads as "783 of your bookmarks were dropped" when 25 were.
- The report is **96% noise.** The 25 entries a user could act on are buried
  under 758 rows saying an empty slot was empty.

An empty slot is not an error, was never a bookmark, and there is nothing the
user can do about it. It should not be created, counted, or reported.

## What Changes

- A uTab bookmark entry whose `url` is absent, not a string, or empty after
  trimming is treated as an **empty slot**: silently ignored. It is not
  created, not added to the `skipped` count, and produces no report row.
- The same filter applies to bookmarks orphaned by a folder that could not be
  created. Today each one emits a `parent-skipped` row, so a single
  blank-named folder would contribute up to 83 rows of pure noise.
- `skipped` in the import summary therefore comes to mean "an entry that looked
  like a real bookmark and could not be imported" rather than "an array element
  that did not become a bookmark". Against the export above this turns
  *skipped 783* into *skipped 25*, and the 789-line report into a 31-line one.

**The predicate is the empty url alone.** Title and `_id` are deliberately not
consulted. Accepted consequence: a uTab entry carrying a title but no url would
also be dropped silently, where today it is reported. No such entry exists in
the observed export, and the simpler rule is the one that can be stated in a
sentence. See `design.md`.

Not in scope:

- **The 25 genuine losses.** Rescuing a blank-titled bookmark via `title := url`
  plus a `tooltip` label is Thread 1 of `rework-utab-import`, unchanged by this
  proposal except that its true scope is now known to be 25 entries, not 783.
- **Empty *folder* slots.** A folder has no url, so this predicate cannot
  express one. All 12 folders in the observed export imported successfully, so
  there is no evidence uTab emits folder placeholders at all.
- **Populating the `error` column for `icon-failed` rows** — a separate defect
  the same report exposed.

## Capabilities

### New Capabilities

None. This narrows an existing capability.

### Modified Capabilities

- `bookmark-import`: the "Skip-and-Report of Invalid Entries" requirement gains
  the distinction between an entry that failed to import and an array element
  that was never an entry, and one requirement is added defining an empty slot
  and its handling.

## Impact

**Code**

- `src/lib/import/utab.ts` — a guard before `createBookmark` in the main loop
  (`:190`), and the same guard in the orphaned-bookmark loop (`:161`). Both
  `continue` without touching `skipped` or `rows`.
- `src/lib/import/utab.test.ts` — coverage for the new guard, and for the
  boundary it must not cross: a present-but-unsafe url still skips and reports.
- `e2e/import-utab.spec.ts` — the fixture gains a url-less entry; the asserted
  report body must not contain a row for it.

**Behavior**

- Strictly fewer bookmarks are created? **No** — the entries being dropped
  already failed `createBookmark`. Nothing that imports today stops importing.
  Only the summary count and the report contents change.
- The skipped count drops sharply for real uTab exports. Anyone comparing
  against a previously downloaded report will see a much shorter file; that is
  the point, but it is a visible change in a number the user has already seen.

**Sequencing**

- Independent of `place-bookmarks-at-real-grid-capacity`. Touches only the
  importer, not placement.
- Best landed **before** Thread 1 (blank-title fallback), so that Thread 1's
  effect is measurable: with the noise gone, the report shrinks to exactly the
  entries Thread 1 is meant to rescue.
- Thread 1 has since also settled on substituting `"New Folder"` for a blank
  folder name, which will make the orphaned-bookmark branch this change guards
  unreachable. The guard is still needed until then; see `design.md`.
