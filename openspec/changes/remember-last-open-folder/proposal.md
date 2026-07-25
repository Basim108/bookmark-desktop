## Why

Every new tab opens on the first root folder (Bookmarks Bar) with the entire
folder tree collapsed, regardless of where the user was working a moment ago.
Anyone whose bookmarks live in a nested folder re-navigates the same path on
every single new tab — on the surface this extension is opened most often. The
active folder is currently in-memory React state (`App.tsx`), so it dies with
the tab.

## What Changes

- The folder the user selects in the sidebar is persisted, and a newly opened
  new-tab page restores it as its active folder — including after the browser
  has been closed and reopened.
- The restored folder's ancestor chain is auto-expanded on load, so the active
  row is actually visible in the sidebar instead of hidden inside collapsed
  parents. Expansion is *derived* from the restored selection, not itself
  persisted.
- Restoration is deliberately **not** propagated to already-open tabs: selecting
  a folder in one tab never changes the active folder of any other open tab.
  This is an intentional departure from the extension's prevailing live-sync
  behaviour and is specified as an explicit prohibition so it is not later
  "fixed" into a bug.
- A stored folder that no longer exists — deleted, or its id reassigned by
  Chrome bookmark sync on another profile — falls back to the first root folder
  without overwriting the stored value.
- The last-opened folder is excluded from state export/import: it is session
  state, not a user preference, and restoring one machine's cursor position
  from a backup file is noise.

No behaviour is removed, and first-run behaviour (no stored folder yet) is
unchanged: the first root folder is selected.

## Capabilities

### New Capabilities

None. The behaviour extends existing sidebar selection semantics rather than
introducing a separate capability; splitting it out would fragment "what the
sidebar does" across two spec files.

### Modified Capabilities

- `folder-sidebar`: `Folder Selection Filtering` gains persistence — the
  selected folder is stored and restored on load, its ancestor chain is
  expanded to reveal it, a stale stored folder falls back to the first root,
  and restoration explicitly does not propagate to already-open tabs.
- `state-transfer`: `Export Entire Extension State to a JSON File` gains an
  explicit exclusion of the last-opened-folder key, so the omission reads as a
  decision rather than an oversight.

## Impact

**Code**

- `src/lib/storage/schema.ts` — new top-level `lastFolderId` key and its
  `STORAGE_KEYS` entry. Kept out of `GeneralSettings` to avoid the
  read-modify-write race with `setCanvasBackground`, and to keep session state
  out of user preferences.
- `src/lib/storage/lastFolder.ts` (new) — read (with existence + is-a-folder
  validation) and write helpers.
- `src/newtab/App.tsx` — the active folder becomes an async-restored value;
  canvas render is gated on the restore resolving so the page never paints the
  wrong folder first.
- `src/newtab/components/Sidebar.tsx` — owns the expanded-folder set, seeded
  once from the restored folder's ancestor chain.
- `src/newtab/components/FolderTreeNode.tsx` — **structural refactor**: local
  `expanded` state is lifted to `Sidebar` and received as props. Touches every
  folder row and its existing tests.

**Reused, unchanged**

- `getFolderAncestorChain()` (`src/lib/bookmarks/read.ts`) already performs
  exactly the parent walk the reveal needs.

**Not affected**

- No new manifest permissions; `chrome.storage.local` is already used.
- No `storage.onChanged` subscription is added — this state intentionally does
  not live-sync.
- `src/lib/transfer/*` — export/import payload shape is unchanged, since the
  new key is excluded.

**Tests**

- Vitest: storage helpers, stale/invalid-id fallback, ancestor-chain seeding,
  `FolderTreeNode` prop-driven expansion.
- Playwright e2e: select a nested folder, open a new tab, assert it opens on
  that folder with the chain expanded; assert an already-open tab does not
  change folder.
