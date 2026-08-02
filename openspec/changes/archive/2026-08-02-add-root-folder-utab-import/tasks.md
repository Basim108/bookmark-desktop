## 1. Progress reporting in the importer

- [x] 1.1 Add an optional `onProgress` parameter to `importUtabExport` (`src/lib/import/utab.ts:180`). Additive — every existing caller must keep working unchanged.
- [x] 1.2 Compute the attempted total in a pre-pass over the already-parsed export: every folder, plus every bookmark for which `isEmptySlot` is false. It MUST reuse the same `isEmptySlot` predicate the creation loop uses — a second, hand-rolled emptiness check will drift and the readout will finish early or never reach its total.
- [x] 1.3 Report progress after each folder and each attempted bookmark. Do not report for skipped empty slots; they are not in the denominator.
- [x] 1.4 Invoke the callback defensively. It runs inside the importer's `try`, so a throwing consumer would be caught by the fatal path and abort a healthy import.
- [x] 1.5 Unit tests in `src/lib/import/utab.test.ts`: the count is monotonic and ends exactly at the total; the total excludes empty slots; omitting the callback changes nothing; a throwing callback does not abort the import.

## 2. Shared spinner

- [x] 2.1 Create a shared spinner component. The codebase's first *keyframe* animation — zero `@keyframes` and zero `animation:` declarations existed, though `transition: opacity` on the row buttons meant motion was not entirely absent — so it establishes the pattern rather than following one.
- [x] 2.2 Add a `@media (prefers-reduced-motion: reduce)` rule that removes the rotation while still conveying the in-progress state. Also the codebase's first reduced-motion query.
- [x] 2.3 Size it against the sidebar's existing glyph controls (`+`, `⚙`) so it does not visually outweigh them.
- [x] 2.4 Test that the reduced-motion rule exists and targets the animated element (jsdom cannot observe animation, so assert the rule/class contract, not motion).

## 3. Root-row import button

- [x] 3.1 In `src/newtab/components/FolderTreeNode.tsx`, render an import button gated on `isRoot` — the inverse of the gear's `!isRoot` gate at `:147` — positioned immediately before the add-subfolder button at `:133`.
- [x] 3.2 Tooltip `Import uTab Bookmarks`, plus an accessible label. Follow the existing pattern on the sibling buttons, which carry both `aria-label` and `title`.
- [x] 3.3 Confirm it does not open `FolderSettingsWindow`. Reusing that component for a root — even with fields hidden — violates `folder-sidebar` "there SHALL be no way to open a settings window" for a root.
- [x] 3.4 Tests in `FolderTreeNode.test.tsx`: present on roots, absent on non-roots, correct tooltip, and ordered before `+`.

## 4. Confirmation window

- [x] 4.1 Create a confirmation component as its own window — NOT a third mode on `FolderSettingsWindow` (see 3.3). Reuse the existing modal CSS/chrome.
- [x] 4.2 It names the target root and offers cancel / proceed. Proceeding opens the OS file picker; the picker must be triggered synchronously inside the user-gesture handler, as `handleImportUtabClick` already does at `FolderSettingsWindow.tsx:181`.
- [x] 4.3 Cancelling creates nothing and opens no picker.
- [x] 4.4 Tests: cancel path creates nothing; proceed path reaches the picker; the target root is named in the dialog.

## 5. Progress and result toast

- [x] 5.1 Create a toast component rendered through `createPortal`, as `FolderSettingsWindow` already does. It must NOT be a child of the sidebar — the sidebar's minimum width is 40px and a clipped toast is unreadable exactly when it matters.
- [x] 5.2 In-progress state: spinner plus the determinate count from task 1.
- [x] 5.3 Result state: counts plus the report filename, dismissed only by explicit acknowledgement. No timer. Mirrors `GeneralSettingsWindow.tsx:150-156`, which waits for acknowledgement before reloading because a reload would erase the message.
- [x] 5.4 Decide the stacking order against the existing modal backdrop — a non-root import can be running in the gear window while a root toast is visible. Make it deliberate, not incidental.
- [x] 5.5 Tests: the toast survives selecting a different folder; the result stays until acknowledged; the filename is rendered.

## 6. Import orchestration in Sidebar

- [x] 6.1 Lift in-flight import state into `src/newtab/components/Sidebar.tsx:39`, alongside the existing `openWindow`. Two reasons: one-import-at-a-time must be enforceable across all root rows, and the toast must outlive a row re-render (live bookmark sync refetches the tree throughout an import).
- [x] 6.2 Disable the import button on every root row while an import is in flight.
- [x] 6.3 Reuse the existing error handling shape from `FolderSettingsWindow.handleImportFileChange` — the `try`/`finally` there exists because a rejection previously left the dialog stuck on "Importing…" forever. The toast must not be able to hang in its in-progress state.
- [x] 6.4 Download the report and format the summary using the existing `reportFileName` / `formatImportReport` / `formatImportSummary` helpers. Do not reimplement.
- [x] 6.5 Call the same post-import refresh the gear flow performs, so the canvas and tree reflect the new items.

## 7. Navigate-away guard

- [x] 7.1 Register a `beforeunload` handler when an import starts; remove it when the import settles, on both the success and failure paths.
- [x] 7.2 Verify it is removed on unmount, so a closed toast or a re-rendered sidebar cannot leave a stale guard warning on every future navigation. This is the failure mode most likely to escape review — it only shows up later, in an unrelated flow.
- [x] 7.3 Tests: the handler is registered during an import and gone afterwards, including after a failed import.

## 8. E2E

- [x] 8.1 Extend `e2e/import-utab.spec.ts` with the root-row path: click the import button on a root row, confirm, choose the fixture file, and assert folders/bookmarks land inside that root.
- [x] 8.2 Assert the confirmation names the root and that cancelling creates nothing.
- [x] 8.3 Assert the result is still visible after selecting a different folder, and that it names the report file.

## 9. Verification

- [x] 9.1 `npm run typecheck && npm run lint && npm run format`
- [x] 9.2 `npm test`
- [x] 9.3 `npm run test:e2e`
- [x] 9.4 Confirm the non-root path is untouched: the gear window's import still works, still shows no confirmation, and its behaviour is unchanged.
- [x] 9.5 Measured at the 40px minimum: the import button's right edge sits at 32px, inside the sidebar's 41px, so it stays fully visible. The row overflows internally by 9px (the folder *name* is what compresses), clipped by the sidebar, which already hides scroll controls by spec. `document.body` gains no horizontal scroll.

## 11. Row control hit targets and hover feedback

- [x] 11.1 Grow the import / add-subfolder / settings controls to a 24x24 pointer target (WCAG 2.2 minimum; they were 16x16) using padding, so the glyph stays at the 16px the folder-sidebar spec pins for the gear. Verified: computed font-size is still `16px`.
- [x] 11.2 Increase the gap between adjacent controls from 4px to 6px, and zero the trailing margin on whichever control is last in the row so the ~3px row edge spacing is unchanged. Measured 4px from the sidebar's right border, within "approximately 3px".
- [x] 11.3 Highlight the individual control under the pointer or keyboard focus, on top of the row-wide highlight, so which of two adjacent buttons is about to be pressed is unambiguous before the click. Suppressed on a disabled control.
- [x] 11.4 Spec the above as an ADDED `folder-sidebar` requirement — these are deliberate values a later refactor could otherwise treat as arbitrary.
- [x] 11.5 E2E regression tests in `e2e/sidebar-resize.spec.ts` for the target size, the gap, the unchanged glyph size, and the per-control highlight. Note both properties are transitioned, so the highlight assertion polls rather than reading computed style on the frame after `hover()`.
- [x] 11.6 Re-measure at the 40px sidebar minimum. The row now overflows internally by 27px rather than 9px — bigger targets clip more of the folder *name* — but no control is newly clipped and `document.body` still gains no horizontal scroll. Accepted: at 40px the sidebar is icon-only regardless, and hit accuracy was the priority.

## 10. Follow-ups (not this change)

- [x] 10.1 Toast anchor: fixed bottom-left, 12px inset, `z-index: 200` — above the modal backdrop's 100, so a result stays readable if a folder window is opened over it.
- [x] 10.2 Progress counts folders *and* bookmarks. Each folder is a real `chrome.bookmarks.create` plus an optional icon write, so excluding them would under-report the work actually being done.
- [x] 10.3 Spinner is a 12px CSS-bordered circle with one transparent edge. It lives in the toast, not on a sidebar row, so it does not introduce a non-glyph control into the row. The transparent edge is also what keeps it legible as "busy" once the animation is switched off under reduced motion.
- [ ] 10.4 `GeneralSettingsWindow`'s `busy` state currently gives no visual feedback and is the obvious second consumer of the new spinner. Out of scope here.
