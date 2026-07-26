## Context

The canvas grid is built from three pieces that each hold part of the sizing
truth, and they disagree:

| Where | What it knows |
|---|---|
| `sizing.ts` `computeGridCapacity` | tier icon size, available width/height |
| `main.css` `.canvas-grid` | `gap: 8px`, `padding: 8px` |
| `Canvas.tsx` | `repeat(cols, ${iconSize}px)` tracks |
| `GridCell.tsx` | `style={{ width: size, height: size }}` |

Capacity is computed without the gap and padding that the CSS then spends, so
the rendered track set is systematically wider than the box it lives in.
`.canvas-grid` has `overflow: auto` with hidden scrollbars, so the excess is
silently clipped rather than announced.

`availableWidth`/`availableHeight` come from `useElementSize`, a
`ResizeObserver` on `.canvas` reporting `contentRect`. `.canvas` itself has no
padding, so that measurement is the true box the grid must fit inside — the
measurement is correct; only the consumption model is wrong.

Two upstream inputs change this measurement at runtime: window resize, and
sidebar drag-resize (`useSidebarResize`, max width up to 1024px on ultra-large
viewports). The sidebar case is the demanding one: it fires continuously
during a pointer drag.

## Goals / Non-Goals

**Goals:**

- Every rendered cell is fully visible inside the canvas, on both axes.
- Horizontal leftover space is spent on the cells, not abandoned at the right
  edge.
- The invariant holds continuously during a sidebar drag-resize, not just at
  rest.
- One formula, one set of layout constants — no second place that can drift.

**Non-Goals:**

- Changing the icon-size tier step function or its 512/1024 breakpoints.
- Making gap/padding user-configurable.
- Vertically distributing leftover space (rows stay top-anchored).
- Any change to how positions are stored, seeded, reflowed, or compacted.

## Decisions

### 1. Capacity accounts for gap and padding

`computeGridCapacity` takes the layout constants and solves for the largest `n`
satisfying `n·icon + (n−1)·gap ≤ available − 2·padding`:

```
usable = max(0, available − 2·padding)
n      = max(1, floor((usable + gap) / (icon + gap)))
```

Applied to both axes with the same constants. The `max(1, …)` floor is retained
so a canvas narrower than one cell still renders a (clipped) single column
rather than an empty grid — an unavoidable degenerate case, and the same
behaviour as today.

Worked example, the screenshot's configuration (`available = 1678`,
`icon = 166`, `gap = 8`, `padding = 8`):

```
usable = 1678 − 16              = 1662
n      = floor(1670 / 174)      = 9      (was 10)
consumed = 9·166 + 8·8          = 1558
leftover = 1662 − 1558          = 104px
```

`resolveTier` keeps taking the **raw** available width, not `usable`. The tier
breakpoints are a published part of the spec ("the canvas's own available
width"); shifting them by 16px would silently re-tier windows sitting near
1024px for no benefit.

### 2. Leftover space goes into the tracks, not the gaps

Alternatives for the 104px:

| Option | Mechanism | Verdict |
|---|---|---|
| A. Wider gaps | `justify-content: space-between` | Rejected |
| B. Even distribution incl. edges | `justify-content: space-evenly` | Rejected |
| C. Wider tracks | `repeat(cols, minmax(0, 1fr))` | **Chosen** |

A and B place the slack *between* droppable elements. `GridCell` is the
dnd-kit droppable; anything outside it resolves to no drop target. Spreading
104px across 8 gaps turns each 8px seam into a 21px dead strip — eight vertical
bands down the canvas where releasing a dragged bookmark does nothing. That is
the same failure class as the just-archived `2026-07-25-fix-cross-page-drag`.

C produces a visually near-identical result (icons land within a few pixels of
where A would put them) while the cell element itself absorbs the space, so the
entire canvas stays droppable. The icon keeps its tier size and is centred by
`.grid-cell`'s existing flex centring.

Consequences:

- `Canvas.tsx` uses `repeat(cols, minmax(0, 1fr))` for columns; rows stay
  `repeat(rows, ${iconSize}px)` since vertical slack is not distributed.
- `GridCell.tsx` drops the inline `width`, keeping `height: size`. The track
  supplies the width.
- The hover/`--over` highlight must be decoupled from the cell element, which
  is now wider than the icon — see decision 4.

### 3. `minmax(0, 1fr)`, not bare `1fr` — and why it covers sidebar resize

This is load-bearing for the sidebar-resize requirement.

A bare `1fr` means `minmax(auto, 1fr)`, whose *auto* minimum refuses to shrink
below the track's content. With a fixed-size icon inside, that floor is the
icon size — so an under-measured grid would overflow rather than compress.
`minmax(0, 1fr)` removes the floor.

That matters because of a one-frame gap in the sidebar drag pipeline:

```
pointermove
   └─▶ setPreferredWidth        (React state)
        └─▶ re-render, sidebar width applied
             └─▶ layout: .canvas contentRect shrinks
                  └─▶ ResizeObserver callback → setSize
                       └─▶ re-render with new capacity  ◀── next frame
```

Between the sidebar taking its new width and the grid re-rendering with the new
column count, the grid is briefly rendering *yesterday's* `cols` at *today's*
canvas width. With fixed `166px` tracks that frame clips — a visible flicker of
half-icons along the right edge on every pointermove that crosses a column
boundary. With `minmax(0, 1fr)` the tracks simply compress a few pixels for one
frame and the corrected count lands on the next. The layout is self-correcting
rather than merely eventually-correct.

So the sidebar-resize guarantee rests on two independent mechanisms: the
capacity formula (correct at rest) and flexible tracks (never clipping in
transit).

### 4. Highlight paints an icon-sized square; the hit area stays the whole cell

Today `.grid-cell` is simultaneously three things: the dnd-kit droppable, the
hover hit area, and the painted highlight surface. That worked while all three
were the same 166px box. Widening the cell to absorb leftover space splits
them apart, and they should not all follow the cell:

| Concern | Size after this change |
|---|---|
| dnd-kit droppable | full track |
| hover / drag-over hit area | full track |
| **painted highlight** | **tier icon size, centred** |

Painting the full track was considered and rejected. With leftover space
distributed, adjacent highlights would be separated only by the 8px gap and
would read as one continuous bar across a full row rather than as discrete
icons — and on a nearly-even width the highlights would very nearly touch. A
fixed square keeps the highlight reading as "this icon," which is what the
affordance is for.

The hit area deliberately does **not** shrink with the paint. The region that
lights up should be the region that accepts a drop; shrinking the trigger to
the square would leave the distributed space silently inert to the mouse
while still accepting drops, which is worse than a hit area that is larger
than its highlight. Hovering a cell's outer edge therefore lights the centred
square — a standard larger-target-than-affordance pattern.

Implementation: `GridCell` renders an inner surface element of exactly
`iconSize × iconSize`, centred by the existing flex centring, which carries the
`background`/`border-radius`. The `--occupied:hover` / `--over` class stays on
the outer cell and selects the inner surface (`.grid-cell--over > .grid-cell-surface`),
so the trigger/paint split falls out of the selector rather than needing extra
pointer logic. This modifies the existing *Cell Hover Affordance* requirement,
which currently mandates highlighting the cell's entire area.

### 5. Layout constants are exported from one module

`GRID_GAP` and `GRID_PADDING` are declared in `sizing.ts` and consumed by
`Canvas.tsx` as inline style, so the values feeding the arithmetic and the
values the browser lays out with cannot diverge. `.canvas-grid`'s `gap`/
`padding` declarations in `main.css` are removed rather than duplicated — a
CSS-side edit that silently invalidated the capacity math is exactly how this
bug arose.

## Risks / Trade-offs

- **One-time visible reshuffle for existing users.** Wide windows lose a column;
  items compact and may cascade to a new page. → Stored positions are never
  mutated by a shrink (`layout.ts` `paginate`), so the arrangement is recovered
  verbatim if capacity grows back. No data is lost; this is cosmetic and
  one-time. Call it out in release notes.

- **Reflow write storm during a sidebar drag.** Dragging the sidebar *narrower*
  grows the canvas; each column boundary crossed fires
  `shouldReflowOnGrowth` → `reflowFolderPositions` → a `chrome.storage.local`
  write plus a cross-tab broadcast. A full-width drag on an ultra-large monitor
  can cross several boundaries in one gesture. → This behaviour is
  **pre-existing** and not introduced here; the new formula only shifts where
  the boundaries fall. Explicitly out of scope, but a follow-up change to
  defer reflow until pointer-up would be worthwhile.

  Verified the change does not make it worse: a column boundary occurs
  wherever `cols` increments, so boundaries sit one cell-pitch apart. The old
  formula's pitch was `iconSize`; the new one's is `iconSize + gap` (174px vs
  166px at the largest tier). Boundaries are therefore strictly *further*
  apart, and any given drag distance crosses fewer or equally many — never
  more.

- **Fewer icons per page on wide screens.** Nine columns where ten used to fit
  is a real reduction in density. → It is the honest capacity; the tenth column
  was never actually usable.

- **Rows keep their unused vertical slack.** Deliberate (top-anchored desktop
  metaphor), but it means the two axes now spend leftover space differently,
  which is a small conceptual inconsistency. → Documented in the spec so it
  reads as a decision rather than an oversight.

- **Highlight no longer marks the full drop area.** A user cannot tell by
  hovering that the space between highlighted squares still accepts a drop. →
  Accepted: the highlight's job is to identify *which icon* is targeted, and
  the ambiguity only exists in a region where the answer is the same either
  way. The `--over` square still moves cell to cell as the pointer crosses
  boundaries, so the targeted cell is never in doubt during a drag.

## Known Limitation (deliberately out of scope)

Row count is derived from the canvas's full height, but `.canvas` is a flex
column holding *both* the grid and the pagination nav. The grid therefore only
gets `canvasHeight − navHeight` while capacity was computed against the whole
thing. When a folder paginates *and* the vertical slack is smaller than the
nav, the bottom row clips — the block-axis twin of the inline-axis bug this
change fixes.

Measured at 1400px wide with 60 bookmarks (nav height 37px):

| Canvas height | rows | Grid bottom | Last cell bottom | Overflow |
|---|---|---|---|---|
| 958 | 5 | 921 | 870 | −51 |
| 900 | 5 | 863 | 870 | **+7** |
| 880 | 5 | 843 | 870 | **+27** |
| 1046 | 5 | 1009 | 870 | −139 |

Pre-existing and not introduced here: the nav has always consumed grid height
while capacity was measured on `.canvas`. Scoped out by decision, and the
*Responsive Grid Sizing* requirement's bottom-row scenario is narrowed to the
single-page case to match what the code actually guarantees.

The fix is not a one-liner, which is why it is its own change: measuring the
grid area instead of the canvas couples capacity to nav visibility, which
depends on page count, which depends on capacity. That loop is bistable rather
than divergent — a folder near the boundary can legitimately settle at either
"1 page, no nav" or "2 pages, with nav" depending on which it reaches first,
and may visibly flip once on load. The clean resolution is to always reserve
the nav's slot (render it with `visibility: hidden` when there is a single
page) so the measured grid height stops depending on page count at all; that
costs a permanent ~37px band beneath every folder, which is a visual decision
worth taking on its own merits.

## Open Questions

None outstanding.
