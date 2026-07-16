## 1. Simplify the storage schema

- [x] 1.1 In `src/lib/storage/schema.ts`, remove the `FolderSidebarDisplay` type and the `sidebarDisplay` field from `FolderSettings` (leaving `{ hasCustomIcon: boolean }`)
- [x] 1.2 In `src/lib/storage/folderSettings.ts`, update `DEFAULT_FOLDER_SETTINGS` to `{ hasCustomIcon: false }`; remove `resolveFolderDisplay` and `setFolderSidebarDisplay`; simplify `setFolderHasCustomIcon` to write only the flag
- [x] 1.3 Update `src/lib/storage/folderSettings.test.ts` to drop display-mode cases and cover the simplified flag behavior

## 2. Default folder icon (shared IndexedDB record)

- [x] 2.1 Add the bundled default icon asset (copy `design/examples/folder.png` into the app, e.g. `src/newtab/assets/folder.png`)
- [x] 2.2 Add a well-known default-icon key (e.g. `DEFAULT_FOLDER_ICON_KEY = "__default_folder_icon__"`) and a one-time seed helper that fetches the bundled asset and `putIcon`s it under that key only if no record exists yet
- [x] 2.3 Invoke the seed once during new-tab app startup (before/at first sidebar render)
- [x] 2.4 Unit-test the seed helper (seeds when absent, no-ops when present) and the key's non-collision with numeric ids

## 3. Always icon + name in the tree row

- [x] 3.1 In `src/newtab/components/FolderTreeNode.tsx`, always render the icon and the label (remove the `display`/`resolveFolderDisplay` branching)
- [x] 3.2 Choose the icon key: `settings.hasCustomIcon ? folder.id : DEFAULT_FOLDER_ICON_KEY`, and pass it to `CustomIconImage`
- [x] 3.3 Confirm the viewport-tiered icon sizing (24px / 32px) still applies to every row

## 4. Lock down root folders (depth 0)

- [x] 4.1 In `FolderTreeNode`, when `depth === 0`, do not render the settings (gear) button
- [x] 4.2 When `depth === 0`, do not wire `useDraggable` (no `listeners`/`attributes` on the row, no drag transform); keep `useDroppable` so roots still accept drops
- [x] 4.3 Verify a bookmark and a non-root folder can still be dropped into a root folder, and that `isOver` highlighting still works on root rows

## 5. Trim the folder settings window

- [x] 5.1 In `src/newtab/components/FolderSettingsWindow.tsx`, remove `DISPLAY_OPTIONS`, the Display radio group, and the `sidebarDisplay` state
- [x] 5.2 Remove the `setFolderSidebarDisplay` call and the label-only clamp from `handleSave`
- [x] 5.3 Update the preview to show the default folder icon when no custom image is staged (replacing the empty `favicon-fallback` span)
- [x] 5.4 Update `FolderSettingsWindow.test.tsx` (drop display-mode assertions; add default-icon preview coverage)

## 6. Verification

- [x] 6.1 Verify: root rows have no gear and cannot be dragged, but still accept dropped bookmarks/folders (unit: `FolderTreeNode.test.tsx` root-folder gating + draggable-attribute checks; e2e: cross-folder-drag)
- [x] 6.2 Verify: a folder with no custom icon shows the default icon; uploading a custom icon replaces it; removing it reverts to the default (unit: `FolderSettingsWindow.test.tsx` default-icon preview + upload/remove; e2e: folder-settings-window custom-image row)
- [x] 6.3 Update/extend `FolderTreeNode.test.tsx` for always-icon rendering and the root-folder gating
- [x] 6.4 Run `npm run typecheck`, `npm run lint`, `npm run test`
- [x] 6.5 Run `npm run test:e2e` (covers drag/persist, folder nav) and confirm green
