## Why

Custom icon uploads for bookmarks and folders are currently rejected if either
pixel dimension exceeds 512px, even though every place a custom icon is
rendered already scales it down (60% `object-fit: contain` in bounded
canvas/grid cells, and explicit tiered sizing in the folder settings popup
preview). The limit blocks legitimate high-resolution source images for no
rendering benefit. Separately, the sidebar's folder row icon (as opposed to
the settings-popup preview) has no explicit size rule today, so once large
images are allowed it would render at its unconstrained intrinsic size and
break the sidebar layout — it needs its own fixed, viewport-tiered size.

## What Changes

- Remove the 512×512px maximum pixel-dimension check from custom icon upload
  validation, for both bookmarks and folders. The file-size limit (1 MB) and
  format/signature validation are unchanged.
- Add explicit sizing for the folder icon shown in the sidebar row itself
  (`FolderTreeNode`'s `.folder-select` icon, not the settings-popup preview):
  24px for viewport widths below 1024px, 32px at 1024px and above.
- Leave the folder settings popup's icon preview sizing (32/48/64px tiers)
  completely unchanged.

## Capabilities

### Modified Capabilities
- `bookmark-icons`: The "Upload Size and Dimension Limits" requirement drops
  its maximum pixel-dimension check; only the maximum file size is enforced.
- `folder-sidebar`: The "Folder Sidebar Display Setting" requirement gains a
  viewport-tiered size (24px / 32px at a 1024px breakpoint) for the folder
  icon rendered in the sidebar row, distinct from the existing popup preview
  sizing.

## Impact

- `src/lib/icons/validation.ts`: drop `MAX_ICON_DIMENSION_PX` and the
  dimension check in `validateIconFile` (and the now-unused
  `readImageDimensions` helper if nothing else uses it).
- `src/lib/icons/errorMessages.ts`: remove the `dimensions-too-large` message
  (or its trigger becomes unreachable — the validation result type may
  shrink).
- `src/newtab/main.css`: add sidebar-row icon sizing rules (base + 1024px
  media query) scoped to the sidebar row, not `.folder-settings-icon-preview`.
- Tests in `src/lib/icons/validation.test.ts` covering oversized-dimension
  rejection need updating/removal.
