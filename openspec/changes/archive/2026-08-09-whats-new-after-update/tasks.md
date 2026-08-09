## 1. The changelog and its build-time bake

- [x] 1.1 Create `CHANGELOG.md` with a documented entry shape: version heading, an optional heads-up sentence, a short bullet list of user-facing changes, and a single rolled-up sentence for bug fixes. Document at the top of the file that it is written **for users** and that the contributor-facing account lives in the GitHub release body
- [x] 1.2 Write the `1.1.0` entry: 61 commits since `1.0.0` condensed to four or five user-facing lines, bug fixes rolled into one sentence, with the heads-up for the one-time layout reflow from the storage-slot migration
- [x] 1.3 Add a parser that extracts the entry matching `package.json`'s version into a structure — `{ version, headsUp?, changes[], fixesNote? }` — rather than leaving it as markdown text (design.md Decision 9)
- [x] 1.4 Unit-test the parser: entry with and without a heads-up, entry with no fixes note, a version with no entry, and a malformed entry
- [x] 1.5 Wire the parse into the build so the current entry reaches the bundle; **fail the build** when the entry for the version being built is missing or unparseable, rather than shipping a window that opens empty
- [x] 1.6 Confirm no copy of the notes exists under `src/` — the changelog is the only source, following the rule `pages.yml` already applies to `PRIVACY.md`

## 2. Storage for the notice state

- [x] 2.1 Add a top-level storage key for the notice state to `src/lib/storage/schema.ts` and `STORAGE_KEYS` — its own key, not a field inside `generalSettings`, so writing it never read-modify-writes a record another writer shares (the reasoning already recorded for `lastFolderId`)
- [x] 2.2 Document in the schema comment that it is installation state rather than user configuration, and is therefore excluded from state export/import, alongside `lastFolderId` and `gridCapacity`
- [x] 2.3 Create `src/lib/storage/releaseNotice.ts` holding the pending notice and the seen version, following the shape of `lastFolder.ts`
- [x] 2.4 Add `src/lib/storage/releaseNotice.test.ts` covering read, write, clear, and the absent-state default
- [x] 2.5 Verify the key is excluded from export and import, and add coverage asserting it — an imported backup must neither suppress an unseen notice nor resurrect a dismissed one

## 3. Update detection in the service worker

- [x] 3.1 Add a `chrome.runtime.onInstalled` handler in `src/background/index.ts` (currently three lines). It must live here, not in the page: the new-tab page may not be open when the update lands
- [x] 3.2 On reason `install`, record the installed version as seen and leave no notice pending
- [x] 3.3 On reason `update`, record a pending notice carrying the previous and new versions
- [x] 3.4 Branch on the event's `reason` only — **never** on whether a seen version is stored. Every user updating from a version predating this feature has no stored version and is nonetheless an update (design.md Decision 1)
- [x] 3.5 Unit-test both reasons, including the update-with-no-stored-version case that task 3.4 exists to protect

## 4. The release-notice window

- [x] 4.1 Create `src/newtab/components/WhatsNewWindow.tsx` — portaled, centered, opaque, with a titlebar and close (✕) control, matching `GeneralSettingsWindow` / `FolderSettingsWindow` / `EditBookmarkWindow`
- [x] 4.2 Render the heads-up as a distinct block ahead of the changes, and only when the entry declares one
- [x] 4.3 Render the changes and the rolled-up fixes sentence as elements built from the parsed structure — never by assigning markup, which `eslint-plugin-no-unsanitized` gates in CI
- [x] 4.4 Show the running version, and the links to the project home, issue tracker, and privacy policy
- [x] 4.5 Vary only the heading by entrance: "What's new" when it opens itself, "About" when opened from Settings. Same content either way (design.md Decision 5)
- [x] 4.6 Add styles to `src/newtab/main.css`, stacking above the existing modal backdrop — the same layering the `.import-toast` comment already documents
- [x] 4.7 Add `WhatsNewWindow.test.tsx`: heads-up shown when declared and absent when not, changes rendered, version shown, both headings

## 5. Automatic appearance

- [x] 5.1 In `App.tsx`, read the pending notice on mount and open the window **after** restoration completes — `AppContent` already models `restoring | restored`
- [x] 5.2 Confirm the window never renders during the restoring state: a user who opens a tab and immediately types in the omnibox is gone before it appears, so the appearance is not spent on them (design.md Decision 2)
- [x] 5.3 Do not open the window when no notice is pending

## 6. Dismissal and cross-tab behavior

- [x] 6.1 Mark the version seen and clear the pending notice on **any** dismissal: close control, Escape, or backdrop
- [x] 6.2 Do **not** mark it seen merely because the window rendered — a user who leaves without dismissing sees it again on a later new tab (design.md Decision 3, a deliberate trade-off)
- [x] 6.3 Subscribe to the notice state through the existing `onChanged` plumbing so a dismissal in one new-tab page closes the window in every other open one
- [x] 6.4 Test the cross-tab path the way `multi-tab-sync.spec.ts` does for other shared state

## 7. About entry point in General Settings

- [x] 7.1 Add an About control to `GeneralSettingsWindow.tsx` that opens the release-notice window
- [x] 7.2 Keep the Settings window mounted beneath it, with staged edits neither saved nor discarded — closing Settings first would silently drop a staged background upload (design.md Decision 6)
- [x] 7.3 Make Escape and the backdrop dismiss only the topmost window while the release-notice window is stacked; confirm normal Settings dismissal resumes once it closes
- [x] 7.4 Confirm the existing rule that Settings cannot be dismissed during a running transfer is unaffected
- [x] 7.5 Extend `GeneralSettingsWindow.test.tsx`: About opens the window, staged edits survive an open-and-close round trip, Escape closes only the topmost

## 8. End-to-end verification

- [x] 8.1 Add an e2e spec for the update path: seed a pending notice, load a new-tab page, assert the window appears after restoration and that dismissing it prevents a reappearance on a fresh page
- [x] 8.2 Assert a fresh profile shows no window — this is also why the existing 20 specs need no changes, since a fresh profile fires reason `install`
- [x] 8.3 Confirm the existing e2e suite still passes unchanged, verifying the assumption in 8.2 rather than assuming it
- [x] 8.4 Run `openspec validate whats-new-after-update --strict`, the unit suite, and the e2e suite; confirm all green
