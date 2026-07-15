## Context

`src/lib/grid/sizing.ts` currently exports `resolveTierIconSize(availableWidth): number`, a discrete 3-tier step function (80px below 1660px, 106px from 1660px to below 2100px, 166px at 2100px and up) keyed on the canvas's own measured available width (`useGridLayout`'s `containerRef`/`useElementSize`, not window width) — a deliberate decision from the prior grid-sizing redesign to keep the grid decoupled from the independently user-resizable sidebar (40–1024px).

Label text has no such tiering today: `.bookmark-icon-label` is hardcoded to `0.75rem` in `main.css`; `.folder-label` (the folder name span in `FolderTreeNode.tsx`) has no font-size rule at all and inherits the browser default (~1rem via `body`'s `system-ui` stack). Neither scales with the grid.

The sidebar already has its own independent tiering system (`useSidebarResize`, driven by `App`'s measured `.app` width, breakpoints at 1024px/1920px) for its max-width — a different mechanism, different basis, different breakpoints from the grid's. This change must not conflate the two: folder-label font-size needs to track the *grid's* tier specifically, which means the value has to originate from Canvas's own width measurement, not from `App`'s width or the sidebar's existing tiering.

## Goals / Non-Goals

**Goals:**
- Bookmark names and folder names both render at a font-size that is always in sync with the canvas grid's current tier: `0.75rem` at the 80px tier, `0.85rem` at the 106px tier, `1rem` at the 166px tier.
- Keep the canvas's available-width measurement exactly where it lives today (Canvas/`useGridLayout`'s own `containerRef`) — do not move or duplicate that measurement.
- Guarantee icon size and label font-size can never independently drift (e.g. someone changes one tier's breakpoint but not the other) by deriving both from one function.

**Non-Goals:**
- Not changing the sidebar's own independent max-width tiering (`useSidebarResize`) or its breakpoints (1024px/1920px) — unrelated system.
- Not changing grid capacity math, pagination, position persistence, or any other `useGridLayout` behavior beyond the tier-resolution function's return shape.
- Not attempting sub-pixel/continuous font scaling — this stays a discrete step function, consistent with every other viewport-tiered feature in this codebase.

## Decisions

**1. One combined tier-resolution function, not two parallel lookups.** `resolveTierIconSize(availableWidth): number` is replaced by a function returning both values for the resolved tier, e.g. `resolveTier(availableWidth): { iconSize: number; labelFontSize: string }`. Alternative considered: a second standalone `resolveTierLabelFontSize` mirroring the same three `if` branches. Rejected — two independently-maintained functions sharing the same breakpoints is exactly the kind of duplication that silently drifts (someone edits one, forgets the other); a single function with one set of branches makes that impossible by construction.

**2. Canvas reports the resolved value upward via callback; the measurement itself stays put.** `Canvas` (or `useGridLayout`) gains a callback prop, e.g. `onLabelFontSizeChange(fontSize: string)`, invoked via a `useEffect` keyed on the resolved value whenever it changes. `App`'s `AppContent` passes this callback, stores the received value in state, and applies it as an inline CSS custom property on the `.app` div it already renders (alongside its existing `appRef`). Alternative considered: lift the canvas's `containerRef`/`useElementSize` measurement itself up to `App`, with `App` passing the ref down into `Canvas` to attach. Rejected — that requires changing `useGridLayout`'s hook signature to accept an externally-owned ref instead of creating its own, rippling into its existing tests and internal structure, for no benefit beyond saving one callback; the reporting-callback approach is a strictly smaller, additive diff that leaves the hook's internals untouched.

**3. CSS custom property (`--label-font-size`) rather than threading the value as a React prop through both subtrees.** `App` sets `--label-font-size` inline on `.app`; `.folder-label` and `.bookmark-icon-label` both simply reference `font-size: var(--label-font-size)` in `main.css`. This is the first CSS custom property used anywhere in this codebase (today only `:root { color-scheme: light dark; }` exists; every other dynamic size is a raw JS number threaded through props/inline styles). Alternative considered: keep threading a plain prop, passing `labelFontSize` down through `Sidebar` → `FolderTreeNode` and separately through `Canvas` → `BookmarkIcon`. Rejected — `BookmarkIcon` already receives `labelFontSize` "for free" as a descendant of `.app` under a CSS custom property (inheritance), while `FolderTreeNode` is nested several props-layers deep inside `Sidebar`; prop-threading would mean touching every intermediate component's prop signature on both branches, whereas one shared CSS rule needs no additional plumbing beyond the single point where the value is set.

**4. Default value covers the pre-mount / no-canvas case.** `Canvas` only renders (and thus only reports a value) when a folder is selected/exists; `Sidebar` can render before that's true. `App` initializes its `labelFontSize` state to the smallest tier's `0.75rem` (matching `resolveTier`'s own first branch, i.e. what a zero-width canvas would resolve to) so `--label-font-size` is never unset on `.app`.

## Risks / Trade-offs

- **[Risk] `resolveTierIconSize`'s call sites all need updating to the new function's shape** (`useGridLayout.ts`, `sizing.test.ts`) — a mechanical but real touch-point across existing code. → **Mitigation**: none needed beyond doing it; no behavior change to `iconSize`/capacity math itself, only the function signature/name.
- **[Risk] One extra render/effect cycle**: the callback-based reporting means `App`'s `--label-font-size` updates one tick after `Canvas` first resolves its tier (state set in an effect, not synchronously during render). → **Mitigation**: accepted — this is a one-time-per-resize flash at most, not visible in practice, and consistent with how `useGridLayout`'s other resize-driven state (capacity, positions) already updates via effects rather than synchronously.
- **[Risk] First CSS custom property in the codebase** introduces a pattern previously absent, which is a minor consistency departure from "all dynamic sizing goes through JS-computed inline px". → **Mitigation**: accepted as the right tool for this specific cross-subtree-inheritance case (see Decision 3); doesn't obligate migrating other existing inline-style sizing to CSS variables.

## Open Questions

None — function shape, reporting mechanism, and CSS-variable approach were all confirmed directly by the user during exploration.
