# Design — simplify-utab-import-flow

> Decisions are settled unless listed under "Open questions". See `proposal.md`
> for motivation.

## Context

Two entry points start a uTab import, and they are built completely differently.

```
  ROOT ROW  [⭳]                     GEAR WINDOW  [⚙] → Import Bookmarks ▾
      │                                   │
      ▼                                   ▼
  ImportConfirmWindow               FolderSettingsWindow owns:
      │  (to be deleted)              importing / importResult state,
      ▼                               its own hidden <input>, its own
  Sidebar: useRootFolderImport        inline "Importing…" text
      │  toast, spinner, count,            │
      │  beforeunload guard                │  no toast, no count,
      ▼                                    ▼  no unload guard
  ImportToast (portalled)            text inside a window that
                                     Escape can close mid-flight
```

The gear window's ownership of in-flight state is what makes finding #7
reachable: `FolderSettingsWindow.tsx:123` closes on Escape unconditionally while
`:97` still holds `importing`.

One constraint rules out the tidiest-looking design. The window's documented
contract is:

> All edits are staged and applied atomically on Save; the close control,
> backdrop, and Escape discard them.

So *closing that window throws away a staged rename or icon upload* — which
means "close it when the import starts" is not a neutral simplification. See
decision 3.

## Goals / Non-Goals

**Goals** — the same quality of progress feedback from both entry points; an
in-flight import that cannot be orphaned by dismissing its window; the
destination visible while it runs; no confirmation step.

**Non-Goals** — changing what an import does; touching the state-transfer
importer; adding a confirmation to the gear path; focus management (tracked in
`focus-name-on-settings-window-open`).

## Decisions

### 1. The file picker is the confirmation

Removing `ImportConfirmWindow` leaves the OS file dialog as the only step
between clicking and importing. That is a real confirmation: it is modal, it
names the operation, and cancelling it creates nothing.

*Alternative rejected:* keep the window but shrink it. The complaint was its
existence, not its size.

### 2. The toast names the destination

The confirmation's one genuinely useful output was *where does this land*. A
toast reading `Importing into Bookmarks bar… 12 / 250` carries that at the
moment it matters, for zero clicks. Without it, removing the confirmation would
lose information rather than just friction.

### 3. The settings window keeps its import, and stops being dismissable while it runs

The window reports progress in place — spinner and determinate count — stays
open for the whole import, and stays open afterwards showing the outcome and the
report filename. It is not dismissable while the import runs: not by Escape, not
by the close control, not by the backdrop.

This is not a new pattern. `GeneralSettingsWindow`, the state-transfer importer,
already does exactly this:

```js
  if (summary) return;                        // :192  acknowledged, not dismissed
  if (busy) return;                           // :194  "must not be dismissed
                                              //        out from under itself"
  const dismissable = !overlay && !busy;      // :291
```

The folder settings window is the only one of the two that never adopted it. So
the change is a convergence, not an invention — two importers, two windows, one
behaviour.

*Alternative rejected: close the window and move progress to the toast.* This
was the earlier design here. It read as tidy — "the window is only a launcher" —
but closing that window **discards staged edits**, which is its documented
contract:

> All edits are staged and applied atomically on Save; the close control,
> backdrop, and Escape discard them.

So starting an import would silently throw away a staged rename or icon upload,
and no timing rule fixed it — only narrowed when it fired. Keeping the window
open removes the problem rather than bounding it.

### 4. Finding #7 is fixed the way its author prescribed

The pre-publication report's remedy for finding #7 was, verbatim:

> Add `if (busy) return;` alongside the existing guards.

Decision 3 is that fix. The earlier design in this document dissolved the bug
structurally instead, by removing the state the guard protects. That worked, but
it was a novel structure where a proven in-repo one already existed. Following
the precedent is the smaller and more reviewable change.

The gear path additionally inherits the `beforeunload` guard, which it has never
had, because that guard lives in the shared hook rather than in either surface.

### 5. Shared logic, per-surface presentation

The hook owns everything that is genuinely common: driving `importUtabExport`
with its progress callback, downloading the report, formatting the summary, and
the `beforeunload` guard. It owns no rendering.

```
                 useUtabImport()          ← progress, report, summary,
                   │           │            beforeunload
        ┌──────────┘           └──────────┐
        ▼                                 ▼
  Sidebar → ImportToast          FolderSettingsWindow
  (root row: no window            (renders spinner + count +
   to report into)                 outcome inline)
```

Two consumers, one behaviour, two renderings. The alternative — one surface for
both — is what decision 3 rejected.

### 6. The picker must open synchronously

A file dialog opened outside a user gesture is blocked. Each entry point
triggers its own input directly from its own click handler, as
`handleImportUtabClick` already does today. Nothing may be deferred into an
effect reacting to state.

Because the settings window keeps its own input and its own handler, this
constraint stays confined to one component per entry point rather than spanning
a prop chain — a further simplification over the earlier design.

## Risks / Trade-offs

**Dismissal must be blocked on all three routes, not just Escape.** → The window
has a close control, a backdrop click, and Escape. Guarding only the one the
audit named would leave two ways to reproduce finding #7. `dismissable` in
`GeneralSettingsWindow` covers all of them; the same shape is required here.

**A blocked window can strand the user if the import never settles.** → The
importer resolves on both success and failure, and the existing `try`/`finally`
exists precisely because a rejection once left the dialog pending forever. That
guarantee is now load-bearing for dismissal, not just for the message.

**The synchronous-gesture requirement is easy to break later.** → A refactor
that routes the picker through state instead of a direct call silently disables
it in production while unit tests, which never open a real dialog, keep passing.
The e2e suite is the only place this surfaces.

**Removing a requirement archived the same day** (`Root Folder Import Confirms
Its Target`, 2026-08-02). → Recorded as a REMOVED delta with its reason, so the
history reads as "built, used, rejected" rather than as an oversight.

**`busy` must now gate the gear entry point too.** → The import menu item needs
the same disabling the root buttons already have, or a second import can be
started from a folder window while one runs.

**The root path still has no way back to a dismissed result.** → Unchanged by
this design, and now asymmetric with the gear path, which keeps its outcome
visible in the window until the user closes it. Acceptable: the root path has no
window to hold it.

## Migration Plan

None. UI-only; no stored data changes shape. Reverting means restoring
`ImportConfirmWindow` and dropping the window's dismissal guards.

## Open questions

1. **Once an import finishes, does the window become dismissable again?**
   `GeneralSettingsWindow` requires its summary to be acknowledged, because a
   reload follows and would erase it. No reload follows a uTab import, so
   requiring acknowledgement here would be heavier than the situation warrants.
   Leaning: dismissable again as soon as the import settles, with the outcome
   left on screen until the user closes the window themselves.
2. **Should `onSaved` still fire after a gear import?** It currently reloads the
   folder's own settings, but an import only creates children — the folder's own
   icon and name are untouched. `forceBookmarkResync()` in the shared flow
   already covers the children. Likely redundant; confirm before deleting.
