## 1. Folder settings window

- [x] 1.1 Add a ref to the Name input in `src/newtab/components/FolderSettingsWindow.tsx` and an effect that focuses it on mount. The field's contents are deliberately **not** selected (reversed after trying selection; see design decision 1).
- [x] 1.2 Effect runs on mount only. Note: no `eslint-disable` was needed — the effect reads only a ref, which is not a dependency, so the empty array passes `react-hooks/exhaustive-deps` unaided. An initial suppression comment was removed as an unused directive.
- [x] 1.3 Use a ref plus `.focus()` rather than the `autoFocus` attribute — explicit at the point of use, and next to the comment explaining why the effect must not re-run. Verified in real Chromium that `focus()` alone leaves a collapsed caret at the end of the value, so no explicit caret positioning is needed.
- [x] 1.4 Confirm this holds in create mode (New Folder draft), where the field is empty.

## 2. Edit Bookmark window

- [x] 2.1 The same in `src/newtab/components/EditBookmarkWindow.tsx`. Its Name field is always pre-filled from `bookmark.title`, so the caret always lands after existing text.
- [x] 2.2 Leave the URL field untouched — not focused, not selected.

## 3. Tests

- [x] 3.1 Both windows: the Name field has focus on open.
- [x] 3.2 Both windows: typing immediately after open **extends** the existing name. Assert the resulting input value, not only `selectionStart`/`selectionEnd` — a selection assertion alone would still pass if the field were unselected but never focused. A companion test asserts the collapsed caret sits at the end.
- [x] 3.3 The New Folder draft is focused with an empty field and accepts typing directly.
- [x] 3.4 Focus is not re-asserted on re-render: move focus elsewhere in the window, trigger a re-render, and confirm focus stays where the user put it. This is the regression that task 1.2 exists to prevent, and it is invisible without a test.
- [x] 3.5 The Edit Bookmark window's URL field is left unfocused and unchanged.

## 4. Verification

- [x] 4.1 `npm run typecheck && npm run lint && npm run format`
- [x] 4.2 `npm test`
- [x] 4.3 `npm run test:e2e` — 57 passed. First run failed entirely on a missing Playwright Chromium binary (`chromium-1234` absent from the cache, an environment issue rather than a code one); resolved with `npx playwright install chromium`.
- [x] 4.4 Confirm the import flow in `FolderSettingsWindow` is undisturbed — progress still renders, the window is still non-dismissable mid-import, and focus does not fight the progress re-renders.

## 5. Follow-ups (not this change)

- [ ] 5.1 No focus trap. Tab still leaves these windows. Confining it raises its own questions — wrapping at the last control, Shift+Tab at the first, interaction with backdrop/Escape dismissal and with the rule that a window running an import cannot be dismissed at all — and belongs in a change of its own.
- [ ] 5.2 No focus restoration to the triggering control on close. Same category as 5.1.
- [ ] 5.3 The General Settings window is untouched: it has no Name field and no single obviously-primary control, so there is nothing to focus that would not be an arbitrary choice.
