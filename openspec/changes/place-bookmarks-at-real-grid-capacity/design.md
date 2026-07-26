# Design — place-bookmarks-at-real-grid-capacity

> **Status: EXPLORATION NOTES, NOT A SETTLED DESIGN.**
> Captured from an explore-mode session on 2026-07-26. Split out of
> `rework-utab-import` (see that change's design.md for the sibling import
> threads). Every "Open question" below is genuinely unresolved. Nothing here
> has been implemented.

## Why this is its own change

This surfaced as "uTab import only fills 24 cells", but it is **not an import
bug**. It is a placement bug in the service worker that affects *every*
bookmark-creation path — Chrome's star button, bookmarks arriving via sync,
programmatic creates — and import merely makes it obvious by creating hundreds
of bookmarks at once. It touches the service worker, the storage schema, and
the grid specs rather than the importer.

Independently corroborated: a prior E2E-test finding already recorded that "a
canvas page can only fill if capacity <= 24 cells; the SW seeds against a fixed
6x4 grid". This is the same defect surfacing in a second place, which suggests
the E2E suite carries a workaround that can be removed once this is fixed.

## Evidence

`design/examples/part_canvas_filled_in_uTab_import.png` shows page 1 holding
exactly **6 columns x 4 rows = 24 items**, with the canvas visibly able to hold
roughly 9 columns x 5 rows (~45 cells), and a "Page 1 of 2" pager.

## Root cause — confirmed

`src/lib/grid/placement.ts:8`:

```ts
/** Default capacity used until Group 4 wires in per-folder resolved grid
    settings (auto/fixed mode + inheritance chain). See design.md open
    questions. */
export const DEFAULT_GRID_CAPACITY: GridCapacity = { cols: 6, rows: 4 };
```

That wiring never happened **for the service worker**. The SW places every
newly created bookmark against the constant:

- `src/lib/bookmarks/events.ts:30` — `placeNewBookmark` calls
  `getNextFreeCell(existing, DEFAULT_GRID_CAPACITY)`.
- `src/lib/bookmarks/events.ts:135` — `backfillFolderPositions(folderId)` with
  no capacity argument, defaulting to 6x4 (`grid/seed.ts:25`).

The page computes the true capacity (`computeGridCapacity`, `grid/sizing.ts:79`
→ ~`{cols: 9, rows: 5}` for the screenshot's geometry) and renders the stored
literal `{page,row,col}` verbatim. Item #24 gets linear index 24; at 6x4
`perPage = 24`, so it becomes `page 1, row 0, col 0` — page 2.

```
  SW wrote (6x4 logic)             canvas can hold (9x5)
  +--+--+--+--+--+--+.........     +--+--+--+--+--+--+--+--+--+
  | 0| 1| 2| 3| 4| 5| .  .  .      |  |  |  |  |  |  |##|##|##|   ## = cells that
  +--+--+--+--+--+--+.........     +--+--+--+--+--+--+--+--+--+   should have been
  | 6| 7| 8| 9|10|11| .  .  .      |  |  |  |  |  |  |##|##|##|   used but were not
  +--+--+--+--+--+--+.........     +--+--+--+--+--+--+--+--+--+
  |12|13|14|15|16|17| .  .  .      |  |  |  |  |  |  |##|##|##|
  +--+--+--+--+--+--+.........     +--+--+--+--+--+--+--+--+--+
  |18|19|20|21|22|23| .  .  .      |  |  |  |  |  |  |##|##|##|
  +--+--+--+--+--+--+.........     +--+--+--+--+--+--+--+--+--+
      === page 2 ===               |##|##|##|##|##|##|##|##|##|
                                   +--+--+--+--+--+--+--+--+--+
```

Note: `onImportBegan`/`onImportEnded` (`events.ts:125-137`) fire only for
Chrome's own HTML bookmark import, **not** for programmatic
`chrome.bookmarks.create` calls. So the uTab import takes the per-item
`placeNewBookmark` path, once per bookmark.

## Why the page does not self-correct

`src/newtab/hooks/useGridLayout.ts:145-169` has repair logic; neither branch
fires after an import:

- `backfillFolderPositions` — runs only on the first measured capacity of a
  session (`!previous`), and only for bookmarks with **no** position. Imported
  bookmarks already have (wrong) positions.
- `reflowFolderPositions` — gated on `shouldReflowOnGrowth(previous, capacity)`
  (`grid/reflow.ts:45`), which requires `cols` to **increase**. The window never
  resized during the import, so `previous === capacity` and nothing repacks.

The repair machinery is correct but keyed on the wrong trigger: it watches for
*viewport* change, whereas what actually went stale was *a write from another
context*.

## Candidate approaches

| # | Approach                                                                                                                          | Fixes                                                        | Cost / risk                                                                                                                                          |
| - | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| A | **Persist measured capacity** to `chrome.storage.local` from the page; SW reads it in `placeNewBookmark` + `backfillFolderPositions` | Root cause. Also Chrome-star bookmarking, sync-created items | New storage key; last-writer-wins across differently-sized windows; SW needs a "never measured" fallback (the existing 6x4 becomes a true bootstrap default) |
| B | **Importer repacks at the end** — page calls `reflowFolderPositions(targetFolderId, realCapacity)` after the loop                    | Import only                                                  | Contradicts the spec line "the importer does not write positions itself"; must wait for all async SW placements to land first — real ordering hazard  |
| C | **Reflow on any positions-changed event**, not just column growth                                                                   | Import + any other stale foreign write                       | Would fight user drags; needs a "did I write this?" discriminator                                                                                     |
| D | **Importer places inline; SW stands down via a lock** — reuses the `transferImportLocked` mechanism already proven for state transfer | Import, deterministically, with no race                      | Two placement authorities to keep in sync; contradicts the same spec line as B; does nothing for non-import creation paths                            |

**Lean: A is the root-cause fix** — the defect is literally "the SW does not
know the capacity", and A is the only option that answers that sentence. B and
D fix only the import path and leave Chrome-star bookmarking broken.

## Open questions

1. **Global or per-folder capacity?** It derives purely from canvas size
   (window + sidebar width), so one global key suffices today. But if
   per-folder grid settings are still planned (the `DEFAULT_GRID_CAPACITY`
   comment references "Group 4… per-folder resolved grid settings"), the
   storage shape should anticipate that now.
2. **Repair for already-placed bookmarks.** A fixes future placements only. Do
   stranded positions from imports already performed get a one-time repack, or
   is "delete and re-import" acceptable? Affects the user's existing uTab
   import directly.
3. **Stale capacity across devices/monitors.** Imported on a laptop, viewed on
   an external monitor — A stores the last-measured value. Acceptable, or does
   this need approach C as a backstop?
4. **Is D worth adopting *alongside* A, given the known race?** A prior finding
   (session memory, `e2e-sw-placement-race`) is that SW auto-placement races the
   page's own backfill write and some placements are lost forever. D would
   eliminate that race for the highest-volume creation path. But it requires
   amending the `bookmark-import` spec requirement "Imported bookmarks are
   positioned automatically … the importer does not write positions itself".
5. **Can the E2E workaround be removed?** The suite currently avoids page-fill
   assertions above 24 cells. Confirm and clean up as part of this change.

## Specs likely affected

- `openspec/specs/bookmark-canvas/spec.md` — the source of placement capacity.
- `openspec/specs/bookmark-import/spec.md` — only if approach B or D wins, to
  amend "the importer does not write positions itself".

## Relationship to the import work

Coupled to `rework-utab-import`'s root-folder import button: adding an easier
import entry point means more imports, and every one hits this bug. **Shipping
the root-import button without this fix makes the bug more visible, not less.**
Sequencing between the two changes is therefore a real decision, not a
formality.
