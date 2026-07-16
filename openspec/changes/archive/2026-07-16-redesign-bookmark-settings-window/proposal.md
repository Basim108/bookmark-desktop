## Why

A bookmark's settings today are an inline `⚙` panel anchored beside the icon
(`BookmarkIcon.tsx`), rendered in-flow and semi-transparent. It only exposes
label-display radios and icon upload/remove — the user can neither rename a
bookmark nor edit its URL without leaving the extension, and the panel's
cramped, anchored layout is easy to dismiss by accident. We want a single,
centered, opaque **"Edit Bookmark"** window that consolidates every per-bookmark
edit — icon, name, URL, label visibility, and deletion — matching the reference
design in `design/examples/05-general-bookmark-settings-window.png`.

## What Changes

- Add a centered, opaque modal **"Edit Bookmark" window** rendered above the
  page via a portal, replacing the inline `bookmark-icon-settings-panel`. Its
  size and internal spacing are taken from the reference screenshot: **440px
  wide**, a **48px title bar**, **~20px content padding**, an **80px icon
  preview**, **~30px-tall** Name/URL fields, and a bottom button row with
  **~36px** buttons.
- Title bar shows **"Edit Bookmark"** on the left and a large (16px), clearly
  hittable **close (✕) icon** on the right.
- **Icon preview** at top-left; to its right a short helper line and a green
  **"Upload image"** button styled like the reference's "Create Preview" button
  (reusing the existing icon upload/validation pipeline). The reference's
  "(How?)" link is dropped. When a custom icon is already set, a **"Remove image"**
  button (revert to favicon) is also shown, preserving today's icon-removal
  capability.
- **Name** field — editable; commits to `chrome.bookmarks.update(id, { title })`.
- **URL** field — editable; validated against the existing safe-scheme allowlist
  (`isSafeNavigationUrl`) and committed to `chrome.bookmarks.update(id, { url })`.
- **Label visibility** — the existing per-bookmark under-icon-vs-tooltip setting
  moves into the window as a single checkbox ("Show label under icon"): checked =
  shown under the icon, unchecked = tooltip-only (label appears on hover). No
  change to the underlying two-mode model.
- **Deferred save model**: Name, URL, image (upload or remove), and the label
  checkbox are all staged in the window and applied only when **Save** is
  clicked. Closing via the **✕**, backdrop, or Escape **discards** unsaved edits.
  (Today's icon upload persists immediately; this change stages it in memory
  until Save via the already-standalone `validateIconFile`.)
- **Remove** button (bottom-left) deletes the bookmark after a **confirmation**
  step, then closes the window. Deletion goes through `chrome.bookmarks.remove`,
  which already cascades cleanup of the bookmark's stored position, settings, and
  custom icon (`events.ts`) and live-refreshes the canvas and sidebar.
- **Save** button (bottom-right) commits all staged edits, then closes. There is
  **no Cancel** button — the ✕/backdrop/Escape serve that role.
- The `⚙` open trigger is retained on each bookmark icon (font-size bumped to
  **16px**) but now opens the centered window instead of the inline panel.

## Capabilities

### New Capabilities

- `bookmark-editor`: the centered Edit Bookmark window — its presentation
  (centered, opaque, sized/spaced per the reference), open trigger, name and URL
  editing, the deferred-until-Save model, and confirmed removal.

### Modified Capabilities

- `bookmark-canvas`: the "Per-Bookmark Label Display" requirement is modified to
  specify the setting is surfaced as a checkbox inside the Edit Bookmark window
  (behavior/model otherwise unchanged).
- `bookmark-icons`: "Custom Icon Upload" and "Custom Icon Removal" are modified to
  reflect that, within the Edit Bookmark window, an upload or removal is **staged**
  and takes effect only when the user saves — while any icon change made outside a
  deferred-save context still applies immediately.

## Impact

- `src/newtab/components/BookmarkIcon.tsx`: remove the inline
  `bookmark-icon-settings-panel` (label radios + `IconUploadControls`); keep the
  `⚙` toggle, now opening the new window.
- `src/newtab/components/EditBookmarkWindow.tsx` (new): the modal, portaled to
  `document.body`; owns staged Name/URL/icon/label state, Save/Remove/close.
- `src/newtab/components/EditBookmarkWindow.test.tsx` (new): staging/discard,
  Save commit, URL validation, confirmed remove, close paths.
- `src/newtab/components/IconUploadControls.tsx`: either repurposed for the
  staged upload (validate-only, no immediate `putIcon`) or superseded by
  window-local upload handling; its immediate-persist behavior no longer used by
  the bookmark window.
- `src/lib/bookmarks/edit.ts` (new, optional): thin wrappers around
  `chrome.bookmarks.update`/`remove` with URL-safety validation, unit-tested.
- `src/newtab/main.css`: add `.edit-bookmark-*` window/title-bar/field/button
  styles (new centered-modal + backdrop pattern; none exists today); bump the
  `.bookmark-icon-settings-toggle` font-size to 16px; remove the now-unused
  `.bookmark-icon-settings-panel` rules.
- `openspec/specs/bookmark-editor/spec.md` (new), `bookmark-canvas/spec.md`,
  `bookmark-icons/spec.md`: requirement changes as described above.
