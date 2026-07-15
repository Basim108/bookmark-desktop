## Context

`src/lib/grid/sizing.ts` names its three tier constants `SMALL_ICON_SIZE`/`MEDIUM_ICON_SIZE`/`LARGE_ICON_SIZE` (48/63/100), and that same number is used identically as the grid cell box, the CSS grid track size, and the `BookmarkIcon` wrapper size (`Canvas.tsx`, `GridCell.tsx`, `BookmarkIcon.tsx` all consume one `iconSize` scalar with no independent scaling). Inside that wrapper, `main.css`'s `.favicon-image`/`.custom-icon`/`.favicon-fallback` rules render the actual glyph at a fixed `60%` of the wrapper box — a rule that predates this change and is not part of it. The net effect today is a mismatch between the constant's name ("icon size") and what's on screen (60% of it).

Separately, `.canvas-grid` has `overflow: auto`, which shows native scrollbars whenever content exceeds the container — even though `useGridLayout`'s pagination already caps each page to the measured capacity and is the intended mechanism for handling overflow. The sidebar (`.sidebar-scroll-area`) already hides its native scrollbars via `scrollbar-width: none` + a `::-webkit-scrollbar { display: none }` override while remaining scrollable by other input.

## Goals / Non-Goals

**Goals:**
- Change only the three numeric tier constants in `sizing.ts` (48/63/100 → 80/106/166) so the existing 60%-shrunk glyph renders close to the originally-intended 48/63/100px, without touching the shrink rule, the breakpoint thresholds, or the step-function approach itself.
- Hide the canvas grid's native scrollbar affordance the same way the sidebar already does, without changing scroll functionality or pagination behavior.

**Non-Goals:**
- Not changing the 60% glyph-to-cell ratio, or resolving the broader "should the ratio be 1.0 / should cells be non-square / should the label move" design question raised during exploration — that's deliberately deferred; this change is a pure constant substitution.
- Not changing `MEDIUM_BREAKPOINT`/`LARGE_BREAKPOINT` viewport-width thresholds, capacity math, pagination, backfill/reflow, or favicon-fetch resolution logic.
- Not adding scroll-position affordances (e.g. custom scroll indicators) — this only removes the native browser scrollbar chrome.

## Decisions

**1. New tier values are 80/106/166, not derived by exact inverse of the 60% rule.** An exact inverse (`desired / 0.6`) gives 80, 105, 166.67 — 80 is exact, but 105 and 166.67 are the two other candidates. The proposal's chosen values (106, 166) are the user-specified, rounded figures: 106×0.6=63.6 (0.6px over the nominal 63px target) and 166×0.6=99.6 (0.4px under the nominal 100px target). Both are sub-pixel-scale deviations from the original 48/63/100 aspiration and are accepted as-is rather than adjusted to 105/167, since the difference is visually indistinguishable and matches what was explicitly requested.

**2. Scrollbar hiding mirrors the sidebar's existing pattern exactly.** `.canvas-grid` gains `scrollbar-width: none;` plus a `.canvas-grid::-webkit-scrollbar { display: none; }` rule, identical in structure to `.sidebar-scroll-area`'s existing treatment two rule-blocks away in the same file. Alternative considered: removing `overflow: auto` entirely (since pagination should mean content never overflows the container). Rejected — `overflow: auto` (with scrollbars hidden) is kept as a defensive fallback for any transient state where rendered content briefly exceeds the container (e.g. mid-resize before capacity recomputes), consistent with why the sidebar also keeps `overflow: auto` rather than `hidden`.

## Risks / Trade-offs

- **[Risk] Grid capacity (cols/rows) drops at every tier** since cell size grows (48→80, 63→106, 100→166), meaning `floor(availableWidth / cellSize)` yields noticeably fewer columns/rows than today, increasing pagination frequency for folders with many bookmarks. → **Mitigation**: none needed beyond awareness — this is an accepted, direct consequence of the explicit numbers requested, not a bug; pagination already handles any resulting overflow.
- **[Risk] Existing unit tests in `sizing.test.ts` assert the old 48/63/100 boundary values** and will fail until updated. → **Mitigation**: update those assertions as part of this change's tasks.
- **[Risk] Sub-pixel rendered-glyph sizes (63.6px, 99.6px) instead of exact round numbers.** → **Mitigation**: accepted; browsers render fractional CSS pixel sizes fine, and the deviation is imperceptible.

## Open Questions

None — values, scope, and CSS approach were confirmed directly by the user during exploration.
