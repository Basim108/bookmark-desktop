## Context

Per-bookmark settings today live in `BookmarkIcon.tsx` as an inline
`bookmark-icon-settings-panel` `<div>` that renders in document flow beside the
icon when a `⚙` toggle is clicked. It holds two things: label-display radios
(`under-icon` / `tooltip`) and `IconUploadControls`, which persists an uploaded
image to IndexedDB **immediately** (`uploadIcon` → `putIcon`). There is no
centered-modal/overlay primitive anywhere in the app — even folder settings use
an anchored inline popup — and no name/URL editing path exists; bookmark title
and URL are read straight from `chrome.bookmarks` and never written back.

The reference design (`design/examples/05-general-bookmark-settings-window.png`,
1236×945) shows a centered opaque window. Measured from the screenshot: window
**≈440px wide × ≈405px tall**, **title bar ≈48px**, **content padding ≈20px**,
**icon preview ≈80px** square, green action button **≈32px** tall, Name/URL
fields **≈30px** tall with the input column right-aligned (~250px) beside a
left label column (~150px), and a bottom button row of **≈36px** buttons
(Remove left, Save right). The window in this change is one row taller than the
reference to accommodate the label-visibility checkbox that moves in from the
old inline panel.

## Goals / Non-Goals

**Goals:**
- One centered, opaque window consolidating icon, name, URL, label-visibility,
  and deletion for a single bookmark.
- A deferred-save model: all edits are staged and applied atomically on Save;
  closing without Save discards them.
- Preserve every capability the inline panel had (label mode, icon upload, icon
  removal) — none silently regress.
- Reuse existing validation/persistence primitives (`validateIconFile`,
  `putIcon`/`deleteIcon`, `isSafeNavigationUrl`, the `events.ts` removal
  cascade) rather than adding new storage or a positioning dependency.

**Non-Goals:**
- No page-screenshot / auto-"Create Preview" capture feature — the green button
  is a plain image upload styled like the reference's button.
- No new modal/popover library — CSS `position: fixed` + a portal to
  `document.body` is sufficient for one centered dialog.
- No change to the icon storage model, favicon fallback, or the
  chrome.bookmarks-event-driven live sync of canvas/sidebar.
- No multi-select / bulk edit; the window edits exactly one bookmark.

## Decisions

**The window is a new `bookmark-editor` capability, not scattered across
`bookmark-canvas`/`bookmark-icons`.**
The window is a coherent, self-contained editing surface with its own
presentation, lifecycle, and save semantics. Name/URL editing and the
deferred-save model have no home in the existing capabilities. The two settings
it *hosts* but does not own — label display (`bookmark-canvas`) and custom icon
(`bookmark-icons`) — stay owned by their capabilities; those specs are modified
only to note they are now surfaced/deferred through the window.

**Rendered via `createPortal` to `document.body`, positioned with
`position: fixed` + a full-viewport backdrop.**
Centering must be relative to the browser window, not the icon's grid cell, and
the window must paint above all canvas/sidebar content opaquely. A portal escapes
the icon's stacking/overflow context; `position: fixed; inset: 0` gives the
backdrop, with the window centered via fl/grid centering on that overlay.
Alternative considered: absolute positioning inside the icon wrapper (as the
folder popup does) — rejected because the icon sits inside the scrollable,
`overflow`-clipped canvas and could never reliably center on the viewport.

**Deferred save via window-local staged state; persistence primitives are only
called on Save.**
The window holds local state for `name`, `url`, the label checkbox, and a
`pendingIcon` discriminated union (`unchanged` | `{ file }` staged upload |
`removed`). Crucially, `validateIconFile(file)` is already exported separately
from `uploadIcon`, so a selected image can be **validated and previewed
(via `URL.createObjectURL`) without writing to IndexedDB**. On Save, in order:
apply the icon change (`putIcon`+`setBookmarkHasCustomIcon(true)`, or
`deleteIcon`+`setBookmarkHasCustomIcon(false)`), then
`chrome.bookmarks.update(id, { title, url })`, then persist the label mode, then
close. On ✕/backdrop/Escape, revoke any object URL and drop the staged state —
nothing was written. Alternative considered: keep immediate persistence and make
Save a no-op close — rejected because it makes ✕ unable to discard and conflicts
with the explicit "deferred until Save" decision.

**URL validation reuses `isSafeNavigationUrl`; an invalid URL blocks Save.**
The URL field is validated on change/Save with the same allowlist used for
click-navigation, surfacing an inline error and disabling Save while invalid, so
we never write a `javascript:`/`data:` URL into `chrome.bookmarks`.

**Removal keeps a confirmation step and leans on the existing cascade.**
"Remove" opens a confirm affordance; on confirm, `chrome.bookmarks.remove(id)`
fires. The background `onRemoved` listener in `events.ts` already deletes the
bookmark's stored position, settings, and IndexedDB icon, and
`subscribeToBookmarkChanges` refreshes the canvas/sidebar — so the window just
closes afterward and does no manual cleanup. Deleting a real Chrome bookmark is
destructive and outside the extension, which is why the confirm step stays
despite the "no Cancel" button.

**Label display becomes a checkbox mapping to the existing two-mode model.**
Checked ⇒ `under-icon`, unchecked ⇒ `tooltip`. This is a presentation change
only; `BookmarkLabelDisplay`, `setBookmarkLabelDisplay`, and the tooltip-on-hover
behavior are unchanged. The old radio group is deleted with the inline panel.

**Icon removal is preserved as a conditional "Remove image" button.**
The reference only shows "Upload image", but the current spec guarantees custom
icon removal (revert to favicon). Rather than regress it, the window shows a
"Remove image" **button** (adjacent to "Upload image") **only when the bookmark
currently has a custom icon**, staged like every other edit. This is the one
element added beyond the literal screenshot.

**The reference's "(How?)" link is dropped.**
The green button is paired with a short static hint only (e.g. "Upload a custom
image for this bookmark"); the "(How?)" link from the reference is not carried
over, since no help doc exists to point it at.

**The `⚙` trigger is retained, restyled to 16px.**
Keeping the existing hover affordance is the least-churn discoverable trigger; it
simply flips window state instead of the inline panel. Only its font-size
changes (16px).

## Risks / Trade-offs

- [Staged image held only in memory as an object URL] → if the window is open a
  long time the blob lives in memory until Save/discard; acceptable for a single
  small (≤1MB) image, and the object URL is always revoked on close.
- [New centered-modal pattern with no focus trap] → mitigated by Escape-to-close
  and backdrop-click-to-close; a full focus-trap/roving-tabindex is out of scope
  but the design leaves room to add one without structural change.
- [`chrome.bookmarks.update` with an empty title] → Chrome permits empty titles;
  we mirror the folder rule and reject empty/whitespace-only names on Save with
  an inline error, so a bookmark can't be saved nameless.
- [Two writers to `hasCustomIcon` (window Save vs. any other caller)] → the
  window is the only bookmark-icon editor after this change, so there is no
  concurrent inline path left; folder icons are a separate surface.

## Open Questions

- None outstanding. Resolved: custom-icon removal is preserved as a conditional
  "Remove image" **button** (shown only when a custom icon exists); the
  reference's "(How?)" link is dropped in favor of a short static hint.
