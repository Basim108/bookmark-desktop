## Why

Two pieces of feedback from using the import flow that shipped in
`add-root-folder-utab-import` (PR #50), plus one live bug they expose.

**The target confirmation is friction, not safety.** Clicking import on a root
row opens a window whose only content is the destination's name and two buttons.
In use it reads as a speed bump rather than a safeguard. Its original
justification — that a row button carries no context about where the import
lands — is real but weaker than it was: the row controls have since grown from
16px to a 24px target with a per-control hover highlight, so the mis-click it
guarded against is materially less likely.

**Progress feedback is uneven across the two import entry points.** The root-row
import shows a spinner and a live count in a toast. The same import started from
a folder's settings window shows the words `Importing…` inside that window and
nothing else. Same operation, same duration, two different levels of feedback.

**That unevenness is a live bug, not just a cosmetic one.**
`design/examples/before-publish-report.md` finding #7 (P2, "Escape can close the
Settings window mid-import") was fixed in `GeneralSettingsWindow` and never in
`FolderSettingsWindow` — which still has an unconditional Escape handler
(`:123`) alongside its own `importing` state (`:97`). Pressing Escape mid-import
today unmounts the window while the import keeps running: the report file still
downloads, the summary is set on an unmounted component, and the user is left
with a mystery file in Downloads and no summary at all. The gear path also has
none of the `beforeunload` protection the root path got.

## What Changes

- The root-row import button SHALL open the file picker immediately. The
  confirmation window is **removed** — **BREAKING** relative to a requirement
  archived earlier the same day; see Capabilities.
- The progress toast SHALL **name the destination folder** (`Importing into
  Bookmarks bar… 12 / 250`). This preserves the one thing the confirmation
  usefully told the user, at the moment it matters and at zero cost in clicks.
- An import started from a folder's settings window SHALL report progress
  **inside that window** — the same spinner and determinate count the root path
  shows, replacing the bare `Importing…` text.
- That window SHALL **stay open** for the whole import and after it finishes,
  showing the outcome and the report file's name in place. It SHALL NOT close
  when the import starts, and SHALL NOT close when it ends.
- While an import runs, that window SHALL NOT be dismissable — not by Escape,
  the close control, or the backdrop.
- The import *logic* SHALL be shared between both entry points — the progress
  callback, the report download, the summary, and the `beforeunload` guard —
  while the *presentation* stays per-entry-point: inline for the window, toast
  for the windowless root row.

### What this fixes

Pre-publication finding #7 is closed by **the fix its own author prescribed**:
*"Add `if (busy) return;` alongside the existing guards."* `GeneralSettingsWindow`
— the state-transfer importer — already implements exactly this, at `:192-194`
and `:291` (`const dismissable = !overlay && !busy`). The folder settings window
is the only one of the two that never adopted it.

That makes this change a convergence rather than a new pattern: two importers,
two windows, one behaviour. The gear path also gains the `beforeunload` guard it
has never had.

### Not doing

- **No change to the state-transfer import** in General Settings. It is a
  different importer with its own confirm/summary flow and its own already-
  correct `busy` guard.
- **No confirmation anywhere else.** Removing it from the root path does not
  imply adding one to the gear path, which never had one and does not need one:
  its target is evident from the window it was launched from.
- **No focus-management work.** Autofocusing these windows' Name fields is
  tracked separately as `focus-name-on-settings-window-open`; it touches the
  same two components but shares none of this change's reasoning.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `bookmark-import`:
  - **Root Folder Import Confirms Its Target** — REMOVED. Built, used, and
    rejected on contact.
  - **Import Reports Live Progress** — widened to every uTab import entry point
    rather than implicitly the root-row one, and to name the destination folder.
  - **Import Result Persists Until Acknowledged** — same widening to both entry
    points.
  - New requirement: a window that launched an import stays open for its whole
    duration and afterwards, reports progress and outcome in place, and cannot
    be dismissed while the import runs.

## Impact

**Code**

- `src/newtab/components/ImportConfirmWindow.tsx` — deleted.
- `src/newtab/hooks/useRootFolderImport.ts` — renamed and generalised; the
  `confirming` state is removed, the destination's title is carried into the
  progress state.
- `src/newtab/components/ImportToast.tsx` — renders the destination name.
  Root-path only; the settings window renders its own progress.
- `src/newtab/components/Sidebar.tsx` — root-row entry point, unchanged in shape.
- `src/newtab/components/FolderSettingsWindow.tsx` — keeps ownership of its
  import but drives it through the shared hook: spinner + determinate count
  replacing the bare `Importing…`, the outcome shown in place, and dismissal
  (Escape, close control, backdrop) blocked while it runs. Follows
  `GeneralSettingsWindow`'s `dismissable` pattern.

**Tests**

- Remove the confirmation tests in `SidebarRootImport.test.tsx` and
  `e2e/import-utab.spec.ts`; replace with "clicking import opens the picker
  directly".
- New coverage: the settings window shows a spinner and an advancing count; it
  stays open through completion and shows the report filename; Escape, the
  close control and the backdrop are all inert while the import runs.

**Risk**

Removing the confirmation means a mis-click on a root row goes straight to the
OS file picker. Cancelling the picker creates nothing, so the exposure is a
stray dialog rather than data loss — accepted deliberately.

**Not affected**

The importer itself. This changes who starts an import and what they see while
it runs, not what an import does.
