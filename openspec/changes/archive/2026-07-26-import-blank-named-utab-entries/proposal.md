## Why

A uTab entry with a blank name is dropped. `createBookmark` and `createFolder`
(`src/lib/bookmarks/create.ts`) both reject an empty or whitespace-only title
with `empty-title`, and the importer counts the entry as skipped and moves on.

Measured against the user's real export
(`design/examples/uTab_settings_26-07-2026-report.log`), **25 bookmarks are
lost this way** — every one a live, well-formed `https://` entry whose only
defect is that uTab stored no title for it:

```
Hrimsoft          https://github.com/Basim108
Hrimsoft          https://hrimsoft.atlassian.net/jira/software/projects/HC/boards/1
Hrimsoft          https://hrimsoft.atlassian.net/wiki/spaces/HRIMCALEND/pages/65566/…
Event Analytics   https://logtail.com/team/167841/tail
Social            https://www.instagram.com/  …and 20 more
```

Nothing about these is invalid. The url — the part that actually identifies the
bookmark and makes it work — is present and safe. Only the human-readable
decoration is missing, and the app already has a display mode for a bookmark
whose name should not be shown on the canvas.

The folder case is worse in kind if not in count: a folder skipped for a blank
name takes **its entire subtree** with it, so one missing string can drop dozens
of perfectly good bookmarks.

## What Changes

- **A blank folder name becomes `"New Folder"`.** The folder is created and its
  bookmarks are imported into it, rather than the folder and its whole subtree
  being skipped. `"New Folder"` is already this app's term for an unnamed
  folder — it is the heading of the create-folder draft window
  (`FolderSettingsWindow.tsx:330`) — so the imported name matches what the
  manual flow would have shown.
- **A blank bookmark title falls back to its url**, and that bookmark's
  `labelDisplay` is set to `"tooltip"` so the url is never rendered under the
  icon and appears only on hover. The mechanism already exists:
  `BookmarkLabelDisplay = "under-icon" | "tooltip"` (`storage/schema.ts:38`)
  and `setBookmarkLabelDisplay` (`storage/bookmarkSettings.ts:25`). This is
  composition, not new machinery.
- The title is the **full url**, not the hostname. Two of the 25 rescued
  entries are `https://hrimsoft.atlassian.net/jira/…` and
  `https://hrimsoft.atlassian.net/wiki/…` — same host, different paths — so a
  hostname title would render them indistinguishable, which is the exact
  failure this fallback exists to prevent.
- **Both substitutions happen in the importer** (`src/lib/import/utab.ts`),
  before `createBookmark` / `createFolder` are called. Those guards are left
  exactly as they are: they also serve the manual add and edit forms, where an
  empty name should still be rejected so the user types one rather than
  silently becoming `"New Folder"`.
- Neither case is counted as skipped or written to the import report any more —
  nothing was skipped.

Not in scope:

- **Relaxing url safety.** `javascript:`, `data:`, `chrome://`, `file:`, and a
  scheme-less `google.com` all remain rejected. The same report measured
  **zero** `unsafe-url` skips in the user's export, so there is no measured
  benefit to weigh against loosening a security allowlist. The previously
  proposed split of `unsafe-url` into "unparseable" vs "disallowed scheme" is
  dropped with it.
- **Entries with no url at all** — empty uTab grid slots, handled by
  `openspec/changes/ignore-utab-empty-slots/`.
- **Populating the `error` column for `icon-failed` report rows**, a separate
  defect the same report exposed.

## Capabilities

### New Capabilities

None. This narrows an existing capability.

### Modified Capabilities

- `bookmark-import`: the "Skip-and-Report of Invalid Entries" requirement stops
  listing a blank folder name or blank bookmark title as a skip reason, and two
  requirements are added defining the two fallbacks.

## Impact

**Code**

- `src/lib/import/utab.ts` — substitute `"New Folder"` before `createFolder`
  (`:150`); substitute the url for a blank title and set `labelDisplay` after a
  successful create (`:190-209`).
- `src/lib/transfer/types.ts` — the note added by `add-utab-import-report`
  predicting that `empty-title` "goes dead for uTab once the blank-title
  fallback lands" becomes a statement of fact. `empty-title` stays in the union
  for state-transfer.
- `src/lib/import/utab.test.ts`, `e2e/import-utab.spec.ts` — coverage.

**Behavior**

- Strictly more bookmarks and folders are created. No entry that imports today
  stops importing, and no entry changes how it imports — only entries that were
  previously dropped are affected.
- The skipped count falls further, and the report shrinks correspondingly.
- Rescued bookmarks render icon-only with a hover tooltip, so a long url never
  appears as canvas text.

**Dependency and sequencing**

- The spec delta is written against the `bookmark-import` spec **as modified by
  `ignore-utab-empty-slots`**, which is expected to archive first. If the order
  is reversed, that delta needs rebasing onto this one — they modify the same
  requirement.
- Landing this change first is safe but leaves the report noisy: without the
  empty-slot filter, the 758 placeholder entries still produce `empty-title`
  rows, because substituting an absent url for a blank title yields a still-blank
  title. Nothing breaks; the improvement is just harder to see.
- Independent of `place-bookmarks-at-real-grid-capacity`.
