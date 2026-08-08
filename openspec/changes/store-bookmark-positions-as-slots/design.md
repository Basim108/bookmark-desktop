## Context

Today the canvas has two contradictory mechanisms for responding to a window
resize, split by direction:

```
  resize ──┬──▶ shrink ──▶ paginate()          display-only, storage untouched
           └──▶ col grow ─▶ repackPositions()  REWRITES STORAGE
```

`repackPositions` sorts every entry in reading order and reassigns dense indices
`0,1,2,…` — its own unit test describes it as "a generic dense repack that
removes gaps for any target capacity". It therefore destroys any gap a user left
around a deliberately-placed bookmark, moving that bookmark to the end of the
pack. The original design (`archive/2026-07-02-bookmark-desktop-new-tab/design.md:33`)
justified persisting the repack "since there's no requirement protecting stored
position during growth", and the same paragraph then asserts that "growing back
to a previously-seen capacity trivially redisplays every item at its true stored
cell" — a claim that only holds if growth does not write. The two halves of that
paragraph contradict each other, and the bug lives in the gap.

Whether a given resize destroys a position depends on `previousCapacityRef`, a
per-tab, per-session, per-folder baseline that is reset on mount and on folder
switch. That is the source of the intermittency: reload, folder switch, a second
tab measuring a different size, overshooting the target width during a drag, or
collapsing the sidebar all re-base it and turn a lossless round trip into a
lossy one.

The underlying cause is representational. A stored `(page, row, col)` is a
coordinate in an unrecorded reference frame; `cellToIndex` reinterprets the same
tuple differently at every column count. "Pull items forward into cells the grid
just gained" therefore cannot be computed from stored state at render time — any
render-time formulation has to rank the entries, and ranking is exactly what
collapses gaps. Mutation was not a shortcut; it was forced by the data model.

## Goals / Non-Goals

**Goals:**

- A drag-assigned position is never changed by anything except another user
  action.
- Resizing the window reflows the layout — an explicitly desirable behaviour, not
  something to suppress — while leaving storage untouched.
- Returning to a previously used window size restores the previous layout
  exactly, for every pair of sizes, without depending on session state.
- Empty cells survive the reflow: a gap the user created is part of the
  arrangement, not slack to be squeezed out.
- Remove the class of bug where two contexts (a new-tab page and the service
  worker) must agree on a capacity in order to place a bookmark consistently.

**Non-Goals:**

- Preserving the *visual* character of a position across sizes. A slot is an
  ordinal, not a location: a bookmark pinned to the bottom-right corner at six
  columns is mid-grid at eight, and a corner again on return. Preserving
  corner-ness across sizes would require a per-folder anchored capacity with
  strictly worse round-trip properties, and is rejected.
- Fixed-mode grids, icon tiers, pagination UX, and drag mechanics — untouched.
- Reconciling two open tabs at different window sizes. With storage no longer
  written on resize, there is nothing left to reconcile.

## Decisions

### Store a capacity-independent slot, not a cell

A bookmark's position becomes a single integer `slot`. Display position is
derived per render:

```
  cell = indexToCell(slot, currentCapacity)
```

```
slots:   0      1      2      3      4      5
       B1-1   B1-2   B1-3   B2-1    ␣     B2-2

@ 3 per page          @ 4 per page              @ 6 per page
┌────┬────┬────┐      ┌────┬────┬────┬────┐     ┌────┬────┬────┬────┬────┬────┐
│B1-1│B1-2│B1-3│      │B1-1│B1-2│B1-3│B2-1│     │B1-1│B1-2│B1-3│B2-1│ ␣  │B2-2│
└────┴────┴────┘      └────┴────┴────┴────┘     └────┴────┴────┴────┴────┴────┘
┌────┬────┬────┐      ┌────┬────┐                        (no page 2)
│B2-1│ ␣  │B2-2│      │ ␣  │B2-2│
└────┴────┴────┘      └────┴────┘
```

`indexToCell` is a bijection between slots and cells at any capacity, so
`A → B → A` is the identity for every pair of window sizes. Restoration stops
being a behaviour that must be implemented and tested case by case, and becomes
arithmetic.

*Alternatives considered.*
**(a) Keep cells, delete only the growth mutation.** Fixes the reported bug and
is a much smaller change, but loses cross-page pull-forward entirely: an item
stored at `(page 1, row 0, col 0)` always "fits" (page is unbounded), so widening
the window leaves it on page 2 while page 1 shows empty new columns. Reflow is
wanted, so this under-delivers.
**(b) Keep cells, add a per-folder authored capacity.** Restores enough
information to compute reflow at render time, but introduces a second piece of
state that can disagree with the stored cells, needs its own migration, and makes
column and row growth behave asymmetrically for no reason a user could predict.
A slot is the same information in irreducible form.
**(c) Store `(page, slot-within-page)`.** Reflows within a page but never merges
or splits pages, so the six-column case above would keep an empty page 2. Fails
the stated behaviour.

### Cells-per-page is the only input; rows and columns are symmetric

Reflow depends on `cols × rows`, not on which dimension changed. This removes the
existing `Row Growth Leaves Empty Cells` requirement, which the original design
labelled "an explicit, asymmetric product rule (not derived from a generic
principle)". Under slots, a taller window pulls later items forward exactly as a
wider one does, which is both consistent and the behaviour the user described.

### Shrink compaction disappears rather than being reimplemented

`indexToCell` is total: every slot maps to a valid in-capacity cell, so no entry
can ever be "displaced". `fitsCapacity`, the displaced list, and the
compact-then-cascade pass in `paginate` have nothing to act on and are deleted.
`paginate` reduces to bucketing slots by `floor(slot / perPage)`.

This also fixes a latent defect nobody reported: today's compaction breaks
reading order, because displaced items are given the lowest free display index
and land *after* items that still fit.

```
   today, 12 items authored at 6 cols, viewed at 4
   ┌──┬──┬──┬──┐        slot model
   │B1│B2│B3│B4│        ┌──┬──┬──┬──┐
   ├──┼──┼──┼──┤        │B1│B2│B3│B4│
   │B7│B8│B9│B10│  ←→   │B5│B6│B7│B8│
   ├──┼──┼──┼──┤        │B9│B10│B11│B12│
   │B5│B6│B11│B12│      └──┴──┴──┴──┘
   └──┴──┴──┴──┘
    B5,B6 below B7-B10
```

### The write boundary is the only place capacity is consulted

A drag resolves against the *displayed* layout — this is already the case
(`grid/dragDrop.ts`, "a drag is always authoritative") — and the resulting
display cell is converted once at the storage boundary:

```
  slot = cellToIndex(dropCell, currentCapacity)
```

Swaps carry the other item's previous slot. `resolveDrop` keeps its current
shape; only the type at its edge changes.

### Placement becomes capacity-free

"Next free cell" is `min(ℕ \ occupied)` — no capacity required. The persisted
measured capacity exists solely to serve `getNextFreeCell` from contexts that
cannot measure one (`grid/seed.ts:34`, `bookmarks/events.ts:34`), so
`storage/gridCapacity.ts`, `DEFAULT_GRID_CAPACITY`, and the capacity-publishing
effect in `useGridLayout` are no longer required by any placement path.

This structurally subsumes `2026-08-02-place-bookmarks-at-real-grid-capacity`:
the service worker can no longer place against a capacity the canvas does not
render at, because it no longer uses a capacity at all.

### Export stays backward compatible

`transfer/version.ts:11` records a project rule that a **major** bump must be
surfaced during the proposal phase, because mismatched-major backups are denied
on import and existing files would be stranded. Emitting a slot in place of
`position` would be exactly that. Instead the export writes **both**: the new
`slot`, and the existing `position` object derived at a fixed reference capacity
for older importers. The importer prefers `slot` and falls back to converting
`position` at that same reference capacity. This is an additive, backward
compatible change: **minor** bump `1.0.0 → 1.1.0`, and `1.0.0` files still
import.

## Risks / Trade-offs

- **[Risk] The migration frame may not match the window the user arranged in.**
  Converting a stored cell to a slot needs a capacity, and none was ever
  recorded. → **Mitigation**: frame on `GRID_CAPACITY`, which is literally the
  capacity a new-tab page most recently measured, i.e. the best available proxy
  for the window the user last arranged in; fall back to `6×4` when absent. If
  the frame is wrong the layout shifts once and is stable thereafter. No better
  option exists — the information was never written down.

- **[Risk] Two tabs at different sizes could migrate the same data differently.**
  → **Mitigation**: migrate once, globally, under the positions lock, gated on a
  schema marker so the second caller observes the completed migration rather
  than re-deriving it.

- **[Risk] The storage change is one-way for older builds sharing the profile.**
  A downgraded build would read slots as cells. → **Mitigation**: version the
  positions store so an older shape is recognisable rather than misread; accept
  that downgrade is unsupported, as it already is for other keys.

- **[Trade-off] A pinned position is an ordinal, not a location.** "I put it in
  the corner" is only true at the size it was placed at. This is inherent to any
  model that round-trips exactly, and is accepted deliberately (see Non-Goals).

- **[Trade-off] Deliberate gaps persist at every size, including narrow ones.**
  A sparse arrangement in a small window shows its gaps and spans more pages
  rather than squeezing up. This is the point of the change: the arrangement is
  predictable, and compaction hides where things actually are.

- **[Known, pre-existing] A drag while the window is small still promotes the
  displayed layout into storage** for the two items involved. That is legitimate
  user action and correct behaviour, but it remains the one way a position
  changes without the user believing they moved that bookmark. Documented, not
  changed.

- **[Risk] Degenerate capacities.** A canvas narrower than one cell floors to
  `1×1`, making `perPage = 1` and turning slot *n* into page *n*. Pre-existing in
  kind, bounded by the same floor as today, and self-correcting on resize since
  nothing is persisted.

## Migration Plan

1. Introduce the versioned slot shape for the `positions` key alongside a schema
   marker.
2. On first read after upgrade, under `withPositionsLock`: if the marker is
   absent, resolve the frame capacity (`GRID_CAPACITY` → `6×4`), convert every
   folder's `(page, row, col)` via `cellToIndex`, write slots plus the marker.
   Subsequent callers see the marker and skip.
3. Ship reader support for both shapes only for the duration of the migration
   path; the marker makes the mixed state unobservable after the first write.
4. Rollback: reverting the build leaves slot-shaped data an older build would
   misread. Rollback therefore requires restoring an exported backup — an
   acceptable posture given the export path stays compatible in both directions.

## Resolved Questions

- **Reference capacity for the exported `position` field: fixed at 6×4.**
  Measured-at-export-time was rejected on two grounds. A capacity is
  device-derived geometry the format deliberately never carries — restoring one
  machine's capacity onto another is the mismatch this whole design removes — and
  a constant makes an export reproducible, so the same state exports identically
  from any window size. The value is part of the file format and must not change
  while the compatibility field is emitted; it lives in
  `lib/transfer/positionCompat.ts` with that constraint stated, independent of
  any grid constant it happens to match.

- **The `GRID_CAPACITY` key is left in place, unread except by the migration.**
  Deleting it was rejected: it is the only surviving record of the frame a
  profile's positions were authored in, and a store that somehow needed
  converting again should convert against the same frame as the first time
  rather than a substituted default. `storage/gridCapacity.ts` keeps only its
  getter — the setter and the publishing effect are gone, and a unit test
  asserts the module exports nothing else, so a future edit cannot quietly
  reintroduce a writer.
