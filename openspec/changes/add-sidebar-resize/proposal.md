## Why

The sidebar has a fixed 240px width with no way for users to make it wider (to read long folder names) or narrower (to reclaim canvas space). It also shows native scrollbars, which look inconsistent with the rest of the desktop-style UI.

## What Changes

- Add a draggable resize handle on the sidebar's right border. Dragging it left/right changes the sidebar's width.
- Enforce a minimum sidebar width of 40px. No maximum is introduced by this change.
- Change the cursor to a horizontal-resize icon (`col-resize`) when hovering the sidebar's right border, even before a drag starts.
- Hide the sidebar's native horizontal and vertical scrollbars (the folder tree remains scrollable via wheel/trackpad/keyboard, just without visible scrollbar tracks).
- Sidebar width persists across sessions (stored alongside existing per-profile UI state) so a resize sticks after reload.
- **Explicitly out of scope**: the canvas's own scroll configuration (`.canvas`, `.canvas-grid`, `useGridLayout`, `useEdgePagination`) is untouched by this change and will be addressed in a separate future feature.

## Capabilities

### New Capabilities
(none — this extends the existing sidebar capability)

### Modified Capabilities
- `folder-sidebar`: adds a requirement that the sidebar is user-resizable via a drag handle on its right border, with a 40px minimum width, resize-cursor affordance on hover, hidden native scrollbars, and persisted width across sessions.

## Impact

- `src/newtab/components/Sidebar.tsx`: add a resize handle element and drag-state wiring (pointer down/move/up).
- `src/newtab/main.css`: replace fixed `.sidebar { width: 240px }` with a width driven by state/CSS variable, add `min-width: 40px`, hide scrollbars (`scrollbar-width: none` / `::-webkit-scrollbar { display: none }`) on `.sidebar`, add `col-resize` cursor styling for the new handle.
- New hook (e.g. `useSidebarResize` or similar) to encapsulate drag-to-resize logic and width persistence.
- Storage: a new small persisted value for sidebar width (e.g. in `chrome.storage.local` alongside other UI/folder settings), read on mount and written on resize (debounced).
- No changes to `Canvas.tsx`, `useGridLayout.ts`, `useEdgePagination.ts`, or any `.canvas`/`.canvas-grid` CSS rules.
