# Design — add-root-folder-utab-import

> Decisions here are settled unless listed under "Open questions". Derived from
> an explore session on 2026-08-02; see `proposal.md` for motivation.

## Context

Import is reachable only from the folder settings (gear) window, and root rows
have no gear. `folder-sidebar/spec.md:282` is explicit and deliberate:

> the system SHALL NOT render a settings (gear) toggle button on a root folder's
> row, and there SHALL be no way to open a settings window … for a root folder

The restriction exists because Chrome refuses `bookmarks.update` on protected
roots, so rename and the icon field are meaningless there. It says nothing about
import, which only creates children — the rule is over-broad rather than wrong.

Existing shape:

```
  FolderTreeNode.tsx
    :133  [+]  add-subfolder      ← unconditional, roots included
    :147  [⚙]  settings            ← gated on !isRoot
              └── FolderSettingsWindow
                    └── {folder && …}  Import Bookmarks ▾ → Import uTab
                                       (importing / importResult state, :123)
```

The new button is the inverse gate of the gear: `isRoot` instead of `!isRoot`.

## Goals / Non-Goals

**Goals** — reach roots; make the target unambiguous before anything is created;
show live progress; keep the existing non-root path untouched.

**Non-Goals** — changing what an import *does* (creation logic, report file,
placement are all unchanged); a multi-format menu on the root button; any import
affordance on non-root rows.

## Decisions

### 1. A separate confirmation component, not `FolderSettingsWindow`

Rendering `FolderSettingsWindow` for a root with the icon/name fields hidden is
the cheap path, and it violates the clause above — the component *is* the
settings window regardless of which fields are visible. A distinct component
reusing the modal CSS keeps the prohibition intact.

*Alternative rejected:* a third mode on `FolderSettingsWindow` alongside `edit`
and `add`. Cheaper, and it would make the spec sentence false.

### 2. Progress counts attempted entries, not raw entries

This is the decision most likely to be got wrong by accident.

A uTab export's `bookmarks` arrays are fixed-size, and most slots are empty
placeholders — in the measured real export, **758 of 996 entries**. The importer
skips them with `if (isEmptySlot(bookmark)) continue;` (`utab.ts`), which costs
nothing.

```
  denominator = raw entries (996)          denominator = attempted (250)
  ├────────────────────────────┤           ├────────────────────────────┤
   0% ──▶ 76% in a few ms                   0% ──▶ 100% at a steady rate
          then crawls for ~30s
   "is it stuck at 76%?"                    honest, monotonic
```

So the denominator SHALL be the count of entries that will actually be
attempted: folders, plus bookmarks that are not empty slots. This requires a
pre-pass over the already-parsed object — cheap, it is in memory — and that
pre-pass MUST use the same `isEmptySlot` predicate as the loop, or the counts
drift apart and progress finishes early or never reaches the total.

*Alternative rejected:* report raw entries. Simpler, no pre-pass, and it
produces a progress bar that lies about exactly the phase the user is waiting
through.

### 3. The result toast persists until acknowledged

It names the downloaded report file. `GeneralSettingsWindow.tsx:150-156` already
establishes this for state-transfer import — it waits for acknowledgement before
reloading, because a reload would erase the message. An auto-fading toast loses
the filename for a slow reader, and the file is the whole point of the report.

### 4. The toast renders through a portal

The sidebar's minimum width is 40px (`folder-sidebar` *Sidebar Resizing*). A
toast clipped to the sidebar would be unreadable precisely when the user needs
it. `FolderSettingsWindow` already uses `createPortal`; same approach.

### 5. In-flight state lives in `Sidebar`, not in the row

`Sidebar.tsx:39` already lifts `openWindow` so only one folder window is open at
a time. Import state belongs at the same level, for two reasons: one import at a
time must be enforceable across *all* root rows, and the toast must outlive a
row re-render (bookmark structure changes during import cause the tree to
refetch).

### 6. The spinner is a shared component with a reduced-motion fallback

There are currently **zero** `@keyframes` and zero `animation:` declarations in
the codebase, and no `prefers-reduced-motion` query at all. Motion is not
entirely absent — the row buttons already use `transition: opacity` — but this
is the first keyframe animation and the first reduced-motion handling, so there
is no pattern to inherit and one has to be set. `@media (prefers-reduced-motion: reduce)`
removes the rotation and leaves the text/glyph. `GeneralSettingsWindow`'s
existing `busy` state (which today only disables buttons) is the second consumer
that justifies making it shared rather than local CSS.

## Risks / Trade-offs

**A non-blocking toast lets the user navigate away mid-import.** → This is a
real regression introduced by choosing a toast over a modal, and neither surface
was weighed for it. Today the gear window is `aria-modal` with a backdrop, so
the canvas cannot be clicked while an import runs. A toast leaves the canvas
live — and clicking a bookmark **navigates the current tab**, unloading the page
and killing the import partway, with real folders and bookmarks already created
and no report written (the report is emitted from the importer's `finally`,
which never runs on unload). See open question 1.

**A throwing progress callback could break an import.** → The callback is
invoked from inside the importer's `try`, so a React state update that throws
would be caught by the fatal path and abort a healthy import. Invoke it
defensively, or document that it must not throw.

**Per-entry `setState` on a large import.** → ~250 updates over tens of seconds
is unremarkable, but the count is user-data-driven and unbounded. Throttle if it
proves to matter; do not pre-optimise.

**Two places now start a uTab import.** → Accepted, and stated in the proposal.
A second import format later must be added to both the gear menu and the root
button.

**Portal z-index against the existing modal backdrop.** → The toast can coexist
with an open `FolderSettingsWindow` (a non-root import could be running while a
root row's toast shows). Stacking order needs to be deliberate, not incidental.

## Migration Plan

None. Additive UI plus an optional parameter on `importUtabExport`; existing
callers are unaffected and no stored data changes shape. Reverting is deleting
the button and the two new components.

## Open Questions

1. ~~Should navigating away mid-import be guarded?~~

   **RESOLVED — `beforeunload` while an import is in flight (2026-08-02, user
   decision).** Registered when an import starts and removed when it settles,
   so Chrome shows its native "Leave site?" prompt if the user clicks a
   bookmark, closes the tab, or reloads. The toast and the live canvas stay
   exactly as chosen.

   Accepted limitations, both inherent to the platform rather than to this
   design: the prompt's wording is Chrome's and cannot be customised, and it
   requires prior user interaction with the page to fire (satisfied here — the
   user clicked the import button). The guard reduces accidental loss; it
   cannot prevent a deliberate "Leave", so a partial import remains possible
   and re-importing duplicates it (`Import Always Creates New Items`).

   Rejected: keeping the confirmation modal open during the import to block the
   canvas. Safest, but it reverses the toast choice; the guard achieves most of
   the protection without changing the UI.

2. **Where does the toast anchor?** Bottom-left near the sidebar, top-centre, or
   pinned to the triggering row's vertical position. Affects nothing structural.
3. **Does the progress readout count folders as well as bookmarks?** Folders are
   ~12 of 250 and each is one `chrome.bookmarks.create` plus an optional icon
   write, so including them is more accurate; excluding them makes the number
   match "bookmarks imported" in the final summary. Cosmetic, but pick one.
4. **Spinner glyph.** A CSS-rotated bordered circle, or an animated character
   cell. The row buttons (`+`, `⚙`) are plain text glyphs, so a bordered circle
   would be the first non-glyph control in the sidebar.
