## 1. Remove the pixel-dimension upload limit

- [x] 1.1 In `src/lib/icons/validation.ts`, remove `MAX_ICON_DIMENSION_PX` and the width/height comparison block in `validateIconFile`; keep `readImageDimensions`'s decode-success check (still needed to catch corrupt/truncated files) but drop its dimension comparison.
- [x] 1.2 Remove `"dimensions-too-large"` from the `IconValidationError` union in `validation.ts`.
- [x] 1.3 In `src/lib/icons/errorMessages.ts`, remove the `dimensions-too-large` entry from `ICON_ERROR_MESSAGES` and drop the now-unused `MAX_ICON_DIMENSION_PX` import.
- [x] 1.4 Update `src/lib/icons/validation.test.ts`: remove/replace the "rejects a file exceeding the max pixel dimensions" test with a case asserting large-dimension files (e.g. well above 512×512) are accepted; keep the "accepts a file exactly at the max pixel dimensions" case or fold it into the new large-dimension acceptance test.
- [x] 1.5 Search for any other references to `MAX_ICON_DIMENSION_PX` or `dimensions-too-large` (e.g. `upload.ts`, `upload.test.ts`, UI copy) and remove them.

## 2. Size the sidebar row's folder icon

- [x] 2.1 In `src/newtab/main.css`, add a `.folder-select .custom-icon` rule sized `24px` × `24px` (base), and a `@media (min-width: 1024px)` override sizing it `32px` × `32px`. Place it near `.folder-select--over`/`.folder-select--dragging`, not inside the `.folder-settings-icon-preview` block.
- [x] 2.2 Verify in the browser (resize below/above 1024px) that the sidebar row's folder icon renders at 24px/32px, while the folder settings popup preview still renders at its existing 32/48/64px tiers unaffected.
- [x] 2.3 Verify bookmark icons in the canvas grid are unaffected (still governed by `.grid-cell` sizing, not the new selector).

## 3. Update specs and verify

- [x] 3.1 Run the project's test suite (`src/lib/icons/*.test.ts` and any folder-sidebar component tests) and fix any failures caused by the removed dimension check.
- [x] 3.2 Manually upload an image larger than 512×512px as both a bookmark icon and a folder icon and confirm both are accepted and render correctly (canvas grid cell and sidebar row respectively).
