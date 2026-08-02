## Why

There is no way to import a uTab export into a root folder. The import control
lives inside the folder settings (gear) window, and root rows deliberately have
no gear — `folder-sidebar/spec.md:282` states the system SHALL NOT render one
for Bookmarks Bar, Other Bookmarks, or Mobile Bookmarks, because Chrome refuses
`bookmarks.update` on them so rename and the icon field are meaningless there.

The gate is well-motivated but over-broad. Renaming a root is invalid; importing
*into* one is perfectly valid — it only creates children. The practical effect
today is that importing into Bookmarks Bar requires creating a throwaway
subfolder, importing there, and then moving every bookmark out by hand. For a
~1000-entry export that is not a workaround, it is a wall.

Now, because this is the last unstarted thread of the uTab import work
(`rework-utab-import` Thread 3), and its one blocking dependency has cleared:
the coupling argument was that an easier import entry point would make the
6x4 placement bug hit more often, and that bug shipped as fixed in
`place-bookmarks-at-real-grid-capacity` (PR #49).

## What Changes

- Root folder rows SHALL render an import button immediately **before** the
  existing add-subfolder (`+`) button, with the tooltip
  `Import uTab Bookmarks`. Non-root rows SHALL NOT gain one — they keep the
  existing path inside the gear window, unchanged.
- Activating it SHALL open a **confirmation naming the target root** before any
  file is chosen. Importing into a root scatters each export folder into that
  root as a subfolder, and for Bookmarks Bar that rewrites Chrome's own visible
  toolbar — a blast radius that reaches outside the extension. The in-gear flow
  needs no such confirmation because its target is obvious from context; a
  toolbar button has no context to supply it.
- Progress and the result SHALL be reported in a **transient toast**, not a
  window. The toast SHALL be rendered through a portal rather than inside the
  sidebar: the sidebar's minimum width is 40px (`folder-sidebar` *Sidebar
  Resizing*), and a toast clipped to it would be unreadable exactly when it
  matters.
- The result toast SHALL persist until acknowledged rather than auto-dismissing.
  It names the downloaded report file, and an auto-fading message would lose
  that filename. This follows the precedent already set for state-transfer
  import (`GeneralSettingsWindow.tsx:150-156`, which waits for acknowledgement
  before reloading because a reload would erase the message).
- A **spinner** SHALL indicate work in progress. **BREAKING for the design
  system, not for users:** this is the codebase's first keyframe
  animation — there are currently zero `@keyframes` and zero `animation:`
  declarations, and no `prefers-reduced-motion` query anywhere (the existing
  `transition` on the row buttons does not respect one either) — so it SHALL be introduced as a shared component with a
  `prefers-reduced-motion: reduce` fallback that removes the rotation. There is
  no existing pattern to inherit, and `GeneralSettingsWindow`'s existing `busy`
  state is an immediate second consumer.
- `importUtabExport` SHALL accept an optional progress callback so the toast can
  show a determinate count (`213 / 996`) rather than a bare spinner. The
  importer already parses the whole file before creating anything, so the total
  is known up front, and the creation loop already maintains the counters. On a
  multi-second import over ~1000 entries a bare spinner cannot distinguish
  "working" from "stuck".
- The progress toast SHALL survive folder selection, and the import button SHALL
  be disabled on every root row while an import is in flight.

### Not doing

- **No import button on non-root rows.** Considered and rejected: it would give
  non-roots two entry points to one operation, or force removing the gear entry
  and adding a third always-present button to every row — on a sidebar that can
  be dragged to 40px. Root-only asymmetry is accepted, and is consistent with
  how roots already differ (no gear, not draggable).
- **No import control in the sidebar header.** A header button acting on the
  active folder would reach roots with no per-row button at all, but it makes
  import stop reading as a property of the folder being pointed at.
- **No multi-source menu on the root button.** The gear window's control is an
  `Import Bookmarks ▾` menu built for several formats; the root button is a
  direct uTab action, matching the requested tooltip. Accepted cost: a second
  format later must be added in two places.
- **No reuse of `FolderSettingsWindow` for the confirmation.** Rendering it for
  a root with the icon and name fields hidden would be the cheap path and would
  violate `folder-sidebar/spec.md:282` — "there SHALL be no way to open a
  settings window" for a root. The confirmation is a separate component.

## Capabilities

### New Capabilities

None. This adds an entry point and feedback to an import capability that
already exists.

### Modified Capabilities

- `folder-sidebar`: **Root Folders Are Non-Editable Drop Targets** enumerates
  exactly what a root row does and does not render. It must now also permit the
  import button, while keeping the gear prohibition and the "no way to open a
  settings window" clause intact — the point of this change is that those two
  rules were conflating "cannot be edited" with "cannot be imported into".
- `bookmark-import`: additive only — new requirements for the target
  confirmation, live progress (including the attempted-entry total and the
  reduced-motion fallback), the persist-until-acknowledged result, the
  navigate-away guard, and one-import-at-a-time.

  Its existing **Import uTab Export Into a Selected Folder** requirement is
  deliberately **not** modified. It already says "a user-selected folder" and
  never excluded roots — the exclusion was an emergent consequence of
  `folder-sidebar`'s gear rule, not something this capability ever specified.
  The import capability was always correct; only its reachability was not.

## Impact

**Code**

- `src/newtab/components/FolderTreeNode.tsx:133` — the import button, rendered
  before the `+` button and gated on `isRoot` (the inverse of the gear's gate at
  `:147`).
- `src/newtab/components/Sidebar.tsx:39` — in-flight import state lifted here,
  alongside the existing `openWindow`, so one import at a time can be enforced
  across rows and the toast can outlive a row re-render.
- New confirmation component — a separate window, not `FolderSettingsWindow`.
- New toast component, portalled (`createPortal`, as `FolderSettingsWindow`
  already does).
- New shared spinner component + its first `@keyframes` and first
  `prefers-reduced-motion` query in the codebase.
- `src/lib/import/utab.ts:180` — optional `onProgress` parameter on
  `importUtabExport`; additive, existing callers unaffected.

**Tests**

- `FolderTreeNode.test.tsx` — button present on roots, absent on non-roots,
  correct tooltip and ordering relative to `+`.
- New coverage for the confirmation (cancel imports nothing) and for the toast
  persisting until acknowledged.
- `src/lib/import/utab.test.ts` — progress callback fires with a monotonic count
  and a correct total, and the importer behaves identically when it is omitted.
- E2E extending `e2e/import-utab.spec.ts` to the root-row path.

**Not affected**

The importer's creation logic, the report file, and placement. This changes who
can start an import and what they see while it runs — not what an import does.
