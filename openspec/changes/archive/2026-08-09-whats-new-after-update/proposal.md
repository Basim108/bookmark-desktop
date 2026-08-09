## Why

Chrome updates extensions silently. A user opens a new tab one morning and the
extension behaves differently, with nothing anywhere to say what changed or
why — the version isn't shown in the UI at all, so they cannot even name what
they are running when reporting a problem.

That is merely unhelpful for an additive change. It is alarming for a
disruptive one. The storage-slot migration already merged for the next release
reflows every user's icon layout once: the data is migrated safely on read and
nothing is lost, but from the outside it looks exactly like the extension lost
their arrangement. The reassurance exists only in a commit footer.

The Chrome Web Store cannot help here. Its API has no release-notes field and
the store has no per-version "what's new" concept for users at all, so the only
place this can live is inside the extension.

## What Changes

- A "What's new" window opens by itself the first time a new tab is opened after
  the extension updates, showing a concise, user-facing summary of that version.
- It opens only on an **update**, never on a fresh install, and only once the
  canvas has finished restoring — so it never lands over a loading page, and
  never burns its one appearance on a tab the user is already navigating away
  from.
- Closing it — close control, Escape, or backdrop — marks the version seen, and
  that clears across every other open new tab at once.
- A **heads-up** block leads the window when the release carries one, carrying a
  single user-facing sentence about a disruptive change. It is rendered only
  when the release has one; by the repository's history that is roughly one
  release in many.
- The same window is reachable at any time from an **About** button in the
  General Settings window, opened stacked above it. Nothing is lost by missing
  the automatic appearance.
- The window shows the running version, closing the gap the issue templates
  already depend on: reporters are asked for a version number the UI never
  displays.
- `CHANGELOG.md` is introduced as the source of the user-facing copy — written
  by hand, in the version-bump pull request, for users rather than contributors.
  The build bakes the **current version's** entry into the bundle.
- The notes ship inside the bundle rather than being fetched at runtime. A
  request to a release API would contradict the published privacy policy, which
  states that the only outbound requests are the declared favicon fetches.
- The seen state is excluded from state export/import, following the precedent
  already set for `lastFolderId` and `gridCapacity`: it describes this
  installation, not anything the user configured.

## Capabilities

### New Capabilities

- `release-notice`: telling users what changed after an update. Covers the
  user-facing changelog as the source of truth, baking the current entry into
  the bundle, detecting the update, the window and its content, the heads-up
  block, the once-per-version lifecycle and its cross-tab behavior, and the
  display of the running version.

### Modified Capabilities

- `general-settings`: gains an **About** entry point in the Settings window that
  opens the release-notice window stacked above it, with the rule that Escape
  and the backdrop dismiss only the topmost window. No existing requirement's
  behavior changes — the Settings window's own staged-edit and dismissal rules
  are untouched, including the deliberate non-dismissability during a running
  transfer.

## Impact

- `src/background/index.ts` — currently three lines; gains a
  `chrome.runtime.onInstalled` handler. It has to be here: the new-tab page may
  not be open when the update lands.
- `src/lib/storage/releaseNotice.ts` (new) + test — the pending-notice and
  seen-version state, as its own top-level storage key so writing it never
  read-modify-writes a record another writer shares (the reasoning already
  applied to `lastFolderId`).
- `src/lib/storage/schema.ts` — one new top-level key and its `STORAGE_KEYS`
  entry, documented as excluded from export/import.
- `src/newtab/components/WhatsNewWindow.tsx` (new) + test — portaled, centered,
  matching the existing three windows' style.
- `src/newtab/components/GeneralSettingsWindow.tsx` — an About button; the
  window stays mounted beneath the stacked release-notice window so staged
  background edits survive.
- `src/newtab/App.tsx` — reads the pending notice and opens the window after
  restoration completes.
- `src/newtab/main.css` — the window's styles and the stacking level above the
  existing modal backdrop, alongside the precedent set by `.import-toast`.
- `CHANGELOG.md` (new) — user-facing, hand-written, one entry per version.
- `vite.config.ts` or a small build step — parses the current version's entry
  and makes it available to the bundle.
- `e2e/` — a spec for the update path. Existing specs are unaffected: a fresh
  Playwright profile fires `onInstalled` with reason `install`, which shows
  nothing.
- No new runtime dependency. No network access. No change to any existing
  stored format.

### Enables

`release-to-web-store` consumes `CHANGELOG.md` and its entry format for its
breaking-change guard and its release process. This change is implemented first
and is useful on its own: the notes ship with the extension whether the release
itself is automated or still done by hand.
