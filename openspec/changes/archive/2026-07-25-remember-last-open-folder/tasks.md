## 1. Storage layer

- [x] 1.1 Add `lastFolderId: string` to `StorageSchema` and `LAST_FOLDER_ID: "lastFolderId"` to `STORAGE_KEYS` in `src/lib/storage/schema.ts`, with a doc comment stating it is session state (not a user preference) and is excluded from state export
- [x] 1.2 Write failing tests in `src/lib/storage/lastFolder.test.ts` covering: read returns the stored id when it resolves to a folder; returns `undefined` when nothing is stored; returns `undefined` when `chrome.bookmarks.get` rejects for an unknown id; returns `undefined` when the id resolves to a bookmark rather than a folder; write stores the id
- [x] 1.3 Implement `src/lib/storage/lastFolder.ts` with `getLastFolderId()` (validating via `chrome.bookmarks.get` + `isFolder()` from `lib/bookmarks/read.ts`, swallowing rejection) and `setLastFolderId(folderId)`, using the existing `getStorageValue`/`setStorageValue` helpers
- [x] 1.4 Confirm no `chrome.storage.onChanged` subscription is added for this key anywhere

## 2. Lift sidebar expansion state

- [x] 2.1 Update `FolderTreeNode.test.tsx` for prop-driven expansion: a node renders expanded when its id is in `expandedIds`, and clicking the toggle calls `onToggleExpand` with its folder id
- [x] 2.2 Replace `FolderTreeNode`'s local `useState(false)` with `expandedIds: Set<string>` and `onToggleExpand: (folderId: string) => void` props, passing both down to child nodes
- [x] 2.3 Rewire the post-create expand call site (`FolderSettingsWindow`'s `onSaved={() => setExpanded(true)}`) to expand via the lifted state, keeping the existing `folder-sidebar` requirement "Saving expands the parent to reveal the new subfolder" green
- [x] 2.4 Give `Sidebar` ownership of the `expandedIds` set alongside its existing `openWindow` state, accepting the initial expanded ids as a prop from `App`
- [x] 2.5 Run `npm run typecheck` to confirm every `FolderTreeNode` call site was updated

## 3. Restore on load

- [x] 3.1 Write failing tests in `App.test.tsx`: a stored folder becomes the active folder on mount; no stored value falls back to the first root folder; an unresolvable stored id falls back to the first root folder and does not write the fallback back to storage; the canvas renders no bookmarks until restoration resolves
- [x] 3.2 Replace `App.tsx`'s `selectedFolderId ?? rootFolders[0]?.id` with an explicit restoration tri-state (`restoring` / `restored(folderId)` / `restored(none)`), reading `getLastFolderId()` once on mount
- [x] 3.3 Gate the `Canvas` render on restoration having resolved, leaving the sidebar to render on its own existing `loading` state so it appears no later than it does today
- [x] 3.4 Call `setLastFolderId` from the folder-selection handler only — not from the restore path and not from the fallback path

## 4. Reveal the restored folder

- [x] 4.1 Write failing tests: restoring a nested folder expands every ancestor between the root folder and it; the restored folder's own subfolders stay collapsed; a restored root folder expands nothing; collapsing a seeded ancestor afterwards leaves it collapsed
- [x] 4.2 On restore, seed `Sidebar`'s `expandedIds` once from `getFolderAncestorChain(restoredId).slice(1)`, dropping the restored folder itself
- [x] 4.3 Verify expansion is never re-derived after the initial seed, so in-session selection and manual collapsing stay fully under user control

## 5. State-transfer exclusion

- [x] 5.1 Add a test asserting an export payload contains no last-opened-folder value, and a test asserting an import leaves the stored `lastFolderId` untouched
- [x] 5.2 Confirm `src/lib/transfer/exportState.ts` and `importState.ts` enumerate storage keys explicitly rather than copying all of `chrome.storage.local`; if either copies wholesale, exclude the new key explicitly

## 6. End-to-end coverage

- [x] 6.1 Add `e2e/last-open-folder.spec.ts`: select a nested folder, open a new tab, assert it opens on that folder with its ancestor chain expanded and its row marked active
- [x] 6.2 Extend that spec: with two tabs open on different folders, selecting a third folder in one leaves the other tab's active folder unchanged
- [x] 6.3 Extend that spec: selecting a folder in a first tab, then a different folder in a second, opens a third tab on the folder selected second
- [x] 6.4 Follow the existing e2e convention of waiting for background auto-placement to settle before asserting, so the new spec does not race the service worker

## 7. Verification

- [x] 7.1 Run `npm run typecheck`, `npm run lint`, and `npm test` and confirm all pass
- [x] 7.2 Run `npm run test:e2e` and confirm all pass, including the pre-existing `multi-tab-sync` and `add-subfolder` specs that the expansion refactor touches
- [x] 7.3 Run `openspec validate --changes remember-last-open-folder --strict` and confirm the delta specs validate
