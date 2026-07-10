## Context

The sidebar (`src/newtab/components/Sidebar.tsx`) currently has a fixed width set purely in CSS (`.sidebar { width: 240px }` in `src/newtab/main.css`), inside a `display: flex` `.app` container alongside `Canvas.tsx`. There is no existing resizable-panel pattern in the codebase to reuse — drag logic elsewhere (`@dnd-kit/core` in `Canvas.tsx`/`BookmarkIcon.tsx`) is item drag-and-drop, not panel resizing, and is not a good fit for a simple edge-drag interaction.

## Goals / Non-Goals

**Goals:**
- Let the user drag the sidebar's right border to resize it, with a 40px minimum width.
- Show a `col-resize` cursor on hover over the draggable border, independent of whether a drag is in progress.
- Hide native scrollbars on the sidebar (both axes) while keeping it scrollable by other means (wheel, trackpad, keyboard).
- Persist the chosen width across reloads.

**Non-Goals:**
- No maximum width constraint (beyond whatever the flex layout naturally allows).
- No changes to `Canvas.tsx`, `useGridLayout.ts`, `useEdgePagination.ts`, or `.canvas`/`.canvas-grid` CSS — canvas scroll behavior is handled in a separate future feature.
- No multi-panel/splitter framework — this is a single fixed-edge resize, not a generic resizable-panels library.
- No touch/pointer-type-specific gestures beyond standard Pointer Events (mouse-first; touch works via Pointer Events but isn't specially optimized).

## Decisions

**1. Plain Pointer Events + local component state, no new dependency.**
A resize handle is a thin `<div>` absolutely positioned on the sidebar's right edge. `onPointerDown` starts a drag: capture the pointer (`setPointerCapture`), record the start X and start width, and listen for `pointermove`/`pointerup` on `window` (not just the handle) so the drag tracks correctly even if the cursor moves faster than layout or leaves the handle's bounds. This avoids pulling in a resizable-panel library for a single-axis, single-handle interaction.
*Alternative considered*: `@dnd-kit/core` (already a dependency). Rejected — it's built around draggable/droppable item semantics (used for bookmark icons), not continuous edge-drag resizing; using it here would be a poor semantic fit and pull in unnecessary sensor/collision machinery.

**2. Width state lives in the `Sidebar` component (or a small `useSidebarResize` hook), applied via inline `style={{ width }}`, not a CSS custom property.**
This matches the existing pattern in `Canvas.tsx` (which already uses inline `style` for computed grid sizing) and keeps `main.css` free of dynamic values. The static rules (`min-width: 40px`, `flex-shrink: 0`, scrollbar hiding, `border-right`) stay in CSS; only the numeric width itself is dynamic.
*Alternative considered*: CSS variable (`--sidebar-width`) set via `style` on a wrapper and read in CSS. Rejected as unnecessary indirection for a single element with a single dynamic property.

**3. Persistence via `chrome.storage.local`, debounced on drag, written once on pointer-up.**
Read the stored width on mount (falling back to the current 240px default if absent or below the 40px minimum). Do not write on every `pointermove` (avoids storage write spam during a drag); write the final value once on `pointerup`. This mirrors how other per-profile UI state is already persisted in this codebase (see `folderSettings.ts`).
*Alternative considered*: `localStorage`. Rejected for consistency — all other durable UI/bookmark state already goes through `chrome.storage.local`, and it's the mechanism that supports the existing cross-tab sync patterns in this codebase.

**4. Scrollbar hiding is CSS-only, scoped strictly to `.sidebar`.**
`scrollbar-width: none` (Firefox) plus `.sidebar::-webkit-scrollbar { display: none }` (Chromium/WebKit) on the existing `.sidebar` rule. `overflow-y: auto` (or `overflow: auto` if horizontal overflow can occur with narrow widths) is kept so the folder tree remains scrollable by wheel/keyboard — only the visible scrollbar track/thumb disappears. This class is entirely separate from `.canvas`/`.canvas-grid`, so there's no risk of the change bleeding into canvas scroll behavior.

**5. Minimum width enforced at the drag-handler level, not just CSS `min-width`.**
Clamp the computed width to `Math.max(40, ...)` inside the `pointermove` handler itself, in addition to keeping a CSS `min-width: 40px` as a defensive backstop. This keeps the drag feel correct right at the boundary (the handle doesn't visually detach from the cursor) rather than relying on CSS alone to stop the box from shrinking further.

## Risks / Trade-offs

- [Drag handle hit-area is thin (a few px), hard to grab precisely] → Give the handle a small invisible padded hit-area (e.g. 6-8px wide) with the 1px visual border centered inside it, same technique commonly used for splitters.
- [Losing pointer capture / drag "sticking" if pointerup fires outside the window] → Listen on `window` for `pointerup`/`pointercancel` and always clean up listeners in a single teardown path (including in a `useEffect` cleanup) so a stray release never leaves the drag "stuck."
- [Hidden scrollbars reduce scroll-affordance discoverability] → Acceptable per explicit product requirement; wheel/trackpad/keyboard scrolling still works, only the visual track is hidden.
- [Persisted width from a previous larger window could look cramped after a browser/monitor resize] → Not addressed by this change (no max-width clamp against viewport); acceptable since flex layout still allows the canvas to shrink rather than overflow.

## Open Questions

- Should the persisted sidebar width be scoped per-window/profile or global to the extension? (Assumed: same storage scope as existing `folderSettings.ts`, i.e. shared across the profile.) Confirm during implementation if this differs from expectations.
