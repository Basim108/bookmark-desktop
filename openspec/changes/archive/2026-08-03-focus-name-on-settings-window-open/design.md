# Design — focus-name-on-settings-window-open

> Short by intent. The proposal already carries the behavioural decisions; this
> records only the choices that are not obvious from it, and the boundary
> against the larger focus work it deliberately stops short of.

## Context

Three windows have a `Name` field and none of them focus it:

| window | component | initial value |
| --- | --- | --- |
| Folder settings (edit) | `FolderSettingsWindow.tsx:342` | `folder.title` |
| New Folder draft | same component, create mode | `""` |
| Edit Bookmark | `EditBookmarkWindow.tsx:242` | `bookmark.title` |

Both components render through `createPortal` into `document.body` and are
`role="dialog" aria-modal="true"`. Neither contains any `.focus()` call, and
there is none anywhere in `src/newtab/` — this is the codebase's first focus
management.

## Goals / Non-Goals

**Goals** — the Name field is focused when any of these three windows opens,
with its existing value left unselected and the caret after it.

**Non-Goals** — a focus trap; restoring focus to the trigger on close; focusing
anything in the General Settings window; any change to saving, validation, or
dismissal.

## Decisions

### 1. Focus, but do not select — reversed after trying it

Selection shipped first, on the Finder/Explorer rename idiom. Using it changed
the conclusion: a fully selected name is one keystroke from being destroyed, and
these windows are opened to *adjust* a name at least as often as to replace it.
Focus removes the click that stood between the user and the field; selection
would additionally have made the destructive outcome the default.

Verified in real Chromium rather than assumed: `input.focus()` on a populated
field leaves a collapsed selection at the end of the value —
`selectionStart === selectionEnd === value.length`. So no explicit caret
positioning is needed, and "focused, not selected" already means "ready to type
at the end", which is the position a rename wants.

### 2. A ref and an effect, not the `autoFocus` attribute

With selection gone, `autoFocus` would technically suffice. A ref is still used:
it keeps the behaviour explicit at the point of use rather than as an attribute
whose timing inside a portal is easy to doubt later, and it sits next to the
comment explaining why the effect must not re-run.

### 3. Focus once, on open — not on every render

`FolderSettingsWindow` re-renders throughout an import now that it reports
progress in place (`simplify-utab-import-flow`). An effect that re-focused on
each render would yank the caret out of the Name field mid-typing, and would do
it most aggressively exactly while an import is streaming progress updates. The
effect runs on mount only.

This is the one place where the two changes genuinely interact.

### 4. Not a focus trap, and the distinction matters

Autofocus decides where focus *starts*. A trap decides where it can *go* — Tab
wrapping at the last control, Shift+Tab at the first, and how both interact with
the backdrop-click and Escape dismissals these windows already have, plus the
new rule that a window running an import cannot be dismissed at all.

That is a materially larger change with its own failure modes, and shipping it
behind a one-line-looking task would be the wrong way to introduce it. Focus
restoration on close is in the same category and is likewise excluded.

## Risks / Trade-offs

**Replacing a whole name now takes an extra gesture** (select-all, or drag) that
selection-on-open would have saved. → Accepted, and the point of the reversal:
the saved gesture was not worth making destruction the default.

**jsdom reports focus and selection faithfully, so tests can over-fit to
mechanism.** → Assert the behaviour that matters — typing immediately after open
*extends* the existing name — rather than only `selectionStart`/`selectionEnd`,
which would keep passing if the field were unselected but never focused. Both
assertions are kept, but the behavioural one is the load-bearing half.

## Open Questions

None. The proposal settles the behaviour and this settles the mechanism.
