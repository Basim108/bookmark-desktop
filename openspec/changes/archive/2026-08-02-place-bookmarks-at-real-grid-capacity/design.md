# Design — place-bookmarks-at-real-grid-capacity

> **Status: SETTLED. Approach A. All five open questions resolved 2026-08-01.**
> Originally captured from an explore-mode session on 2026-07-26 and split out
> of `rework-utab-import` (see that change's design.md for the sibling import
> threads). A second explore session on 2026-08-01 resolved every open question
> and produced `proposal.md`. Nothing has been implemented yet.
>
> **Decision: approach A** — the page persists its measured capacity; the
> service worker reads it. Global key, last-measured-wins, future placements
> only. See "Resolved questions" below for the other four, and "Candidate
> approaches" for why B, C and D lost.

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

**DECIDED: A (2026-08-01, user decision).** The defect is literally "the SW does
not know the capacity", and A is the only option that answers that sentence. B
and D fix only the import path and leave Chrome-star bookmarking broken. C is
not adopted — see resolved question 3.

## Resolved questions

All five were resolved on 2026-08-01. Nothing below is still open.

1. **Global or per-folder capacity?**

   **RESOLVED — a single global value (user decision).** Capacity derives purely
   from canvas geometry (window size minus sidebar width), which no folder can
   vary today. The storage shape does *not* pre-generalize for the "Group 4…
   per-folder resolved grid settings" that `DEFAULT_GRID_CAPACITY`'s comment
   references — that wiring never happened anywhere, and speculatively shaping a
   key around it would add a dimension with no reader. If per-folder grid
   settings ever land, the key gains structure then.

2. **Repair for already-placed bookmarks?**

   **RESOLVED — no repair; future placements only (user decision).** Bookmarks
   already stranded on page 2 by a past import keep their stored positions. The
   remedy is delete-and-re-import.

   Stated plainly because it has a real consequence the user accepted
   explicitly: **their own existing ~1000-bookmark uTab import stays broken**
   after this change ships. The alternative — a one-time repack keyed on
   detecting positions written under a smaller capacity — was not costed,
   because a migration that repacks a user's entire canvas is a larger and
   riskier change than the fix itself, and it would silently move icons the user
   may have since arranged by hand.

3. **Stale capacity across devices/monitors?**

   **RESOLVED — store the last-measured value; accept staleness (user
   decision).** Two new-tab pages open at different window sizes will overwrite
   each other, and the most recent measurement wins with no reconciliation.

   Approach C (reflow on any positions-changed event) is **not** adopted as a
   backstop. It would need a "did I write this?" discriminator to avoid fighting
   user drags, which is real machinery to defend against a case — placing
   bookmarks against a capacity measured on a differently-sized window — whose
   worst outcome is the same class of cosmetic mis-placement the user already
   accepted in question 2.

4. **Is D worth adopting alongside A, given the known race?**

   **RESOLVED — no. D is dropped, and its premise is stale.**

   D's main justification was the placement race recorded on 2026-07-25: SW
   per-item placement and the page's whole-map backfill write clobbering each
   other, losing placements *permanently*. **That race was fixed on 2026-07-26**
   by `make-position-writes-atomic` (commit `8250da3`, archived as
   `openspec/changes/archive/2026-07-26-make-position-writes-atomic/`).
   `withPositionsLock` (`src/lib/concurrency/positionsLock.ts:39`) is a
   `navigator.locks` named lock shared by the service worker and every new-tab
   page — they share the `chrome-extension://<id>` origin — and every
   read-modify-write in `src/lib/storage/positions.ts` now holds it across both
   halves. Verified 2026-08-01: no unlocked write path remains.

   What D would still buy: the page places against a capacity it *just*
   measured, so zero staleness. But question 3 accepted staleness, which
   removes that edge. What it costs: fixes the import path only (Chrome-star and
   sync-created bookmarks still need A anyway), creates a second placement
   authority to keep in sync forever, and requires amending `bookmark-import`'s
   "the importer does not write positions itself". Cost without benefit.

   The lock does impose one constraint on A: `placeNewBookmark` reads capacity
   *inside* `withPositionsLock`, and Web Locks are **not reentrant**
   (`positionsLock.ts:26-36`). The capacity accessor must not take that lock —
   it is a different storage key and must stay that way.

5. **Can the E2E workaround be removed?**

   **RESOLVED — yes, and a real page-fill test replaces it (user decision).**
   Confirmed present at `e2e/grid-fit.spec.ts:144-146`:

   ```
   // … and short enough that a page's capacity stays under the 24 cells the SW
   // seeds per page — paginate() honours stored pages and never compacts
   // forward, so a taller viewport could never fill page 0.
   await page.setViewportSize({ width: 1500, height: 700 });
   ```

   Remove the constraint and the comment, and add coverage asserting a canvas
   page fills **past** 24 cells at a viewport whose real capacity exceeds 24 —
   the assertion that is impossible today and is the direct regression test for
   this change.

   Note this became viable only because of the atomic-writes fix in question 4.
   The prior guidance was to never poll for "all placed" because placements
   could be lost forever; under the lock that barrier terminates.

## Newly identified — the bootstrap case

Not among the original five, surfaced while writing the proposal.

On a fresh profile the service worker can receive `onCreated` before any
new-tab page has ever rendered and measured a capacity. `DEFAULT_GRID_CAPACITY`
is therefore **kept, not deleted** — it becomes the genuine "never measured yet"
bootstrap default rather than the stale placeholder it is today. Its comment at
`placement.ts:8` currently promises Group 4 wiring that never arrived and must
be rewritten to say what the constant actually is now.

## Specs affected — SETTLED

- `openspec/specs/bookmark-canvas/spec.md` — the **Next-Free-Cell Placement**
  requirement gains the capacity that "next free cell" is computed against.
  Today it is silent on this, which is precisely why two contexts could disagree
  without violating it.
- `openspec/specs/state-transfer/spec.md` — the **Export Entire Extension State
  to a JSON File** requirement gains an explicit exclusion for the stored
  measured capacity, mirroring the existing "SHALL NOT contain the last opened
  folder" clause. Same rationale as `lastFolderId`
  (`src/lib/storage/schema.ts:63-71`): device-derived state, not a configured
  setting. Restoring one machine's capacity onto another would reintroduce this
  exact defect.
- `openspec/specs/bookmark-import/spec.md` — **not affected.** It would have
  been only under approach B or D, to amend "the importer does not write
  positions itself". Both were dropped.

## Relationship to the import work

Coupled to `rework-utab-import`'s root-folder import button (Thread 3): adding
an easier import entry point means more imports, and every one hits this bug.
**Shipping the root-import button without this fix makes the bug more visible,
not less.** Sequencing between the two changes is therefore a real decision, not
a formality.

**Still open.** This change is now proposed and Thread 3 has no proposal at all,
so the natural order is this one first — but that has not been decided
explicitly, and Thread 3 still carries its own four unresolved questions.

The other two import threads this was split from have since shipped
(`2026-07-26-ignore-utab-empty-slots`,
`2026-07-26-import-blank-named-utab-entries`), so Thread 3 is the only sibling
left.
