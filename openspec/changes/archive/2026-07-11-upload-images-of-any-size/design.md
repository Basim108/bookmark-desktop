## Context

`validateIconFile` in `src/lib/icons/validation.ts` is the single validation
entry point shared by both bookmark and folder custom-icon uploads. It
currently rejects any file whose decoded pixel width or height exceeds 512px
(`MAX_ICON_DIMENSION_PX`), in addition to enforcing a 1 MB file-size cap and
magic-byte format checks (PNG/JPEG/WebP/AVIF only).

Every place a custom icon is actually displayed already scales it down rather
than rendering at intrinsic size:
- Canvas bookmark icons: `.custom-icon` at `width/height: 60%` inside a
  `.grid-cell` that is explicitly sized in JS (`src/lib/grid/sizing.ts`), with
  `object-fit: contain`.
- Folder settings popup preview: `.folder-settings-icon-preview .custom-icon`
  has its own fixed 32/48/64px tiers keyed off viewport width (1024px,
  1600px), fully independent of the base `.custom-icon` rule.

The one exception is the folder icon rendered directly in the sidebar row
(`FolderTreeNode.tsx`, inside `.folder-select`): there is no `.folder-select`
sizing rule in `main.css` at all, so that `<img class="custom-icon">` only
gets the generic `60%` rule against an unsized ancestor. Today this is masked
by the 512px cap keeping source images small; removing the cap would make
oversized icons blow up that row's layout.

## Goals / Non-Goals

**Goals:**
- Drop the maximum pixel-dimension check from icon upload validation for both
  bookmarks and folders, while keeping the file-size and format checks as-is.
- Give the sidebar row's folder icon (not the popup preview) an explicit,
  viewport-tiered size: 24px below 1024px, 32px at 1024px and up.

**Non-Goals:**
- Changing the 1 MB file-size limit or the accepted-format list.
- Changing `.folder-settings-icon-preview` sizing/behavior (32/48/64px tiers)
  in the folder settings popup — explicitly out of scope per the request.
- Changing bookmark canvas icon sizing — already correctly bounded by its
  sized grid cell and unaffected by the dimension cap's removal.
- Downscaling/re-encoding uploaded images before storage; images continue to
  be stored as-is and scaled purely via CSS at render time.

## Decisions

1. **Remove the dimension check rather than raising its ceiling.** The
   proposal's premise is "any size" — picking a new fixed ceiling (e.g. 2048)
   would just relocate the same problem. Every render site already clamps
   display size via CSS, so there's no rendering reason to cap source pixel
   dimensions. File size (1 MB) remains the real resource guardrail.

   `readImageDimensions` (decodes via `createImageBitmap`) is left in place:
   it's still needed to confirm the file actually decodes as a valid image
   (catches magic-byte-spoofed but corrupt/truncated files) — only the
   width/height comparison against `MAX_ICON_DIMENSION_PX` is removed.

2. **Sidebar row icon sizing follows the existing plain-CSS media-query
   pattern**, matching `.folder-settings-icon-preview`'s approach (`@media
   (min-width: 1024px)`), not the JS-driven `useSidebarResize` viewport-prop
   pattern. The popup preview and sidebar resize hook solve different
   problems (a React-computed max-width vs. a pure display size); a static
   CSS rule is simplest here and keeps the two icon contexts visibly
   independent in the stylesheet, which also reduces the risk of accidentally
   coupling them.

   Scope the new rule to `.folder-select .custom-icon` (the sidebar row's
   icon) so it cannot cascade into `.folder-settings-icon-preview .custom-icon`
   or the canvas's `.custom-icon` usage — CSS specificity naturally resolves
   in favor of the more specific `.folder-settings-icon-preview` selector
   regardless of source order, but scoping the new selector to `.folder-select`
   also keeps canvas bookmark icons (bare `.custom-icon`, `.favicon-image`)
   unaffected.

3. **Two tiers, not three.** The proposal only specifies 24px/32px at a
   1024px breakpoint for the sidebar row — unlike the popup preview's extra
   1600px/64px tier. No third tier is added here; that's a deliberate scope
   boundary from the request, not an oversight.

## Risks / Trade-offs

- [Removing the dimension cap allows a technically-1MB-but-extreme-aspect or
  huge-pixel-count image (e.g. a 1MB highly-compressed 8000×8000 PNG) to be
  decoded via `createImageBitmap`] → Decoding is already required today for
  the dimension check and happens once at upload time, not on every render;
  the file-size cap bounds the worst case. Display is always CSS-clamped, so
  this is a one-time decode cost, not a rendering risk.
- [A future change to `.folder-select`'s layout could unintentionally
  override the new icon-size rule] → Scoping the selector to
  `.folder-select .custom-icon` (rather than restyling `.custom-icon`
  globally) keeps the rule specific and easy to find alongside the sidebar
  row's other styles.

## Migration Plan

No data migration: existing stored icons are untouched. This only changes
validation on future uploads and the sidebar row's display CSS. No rollback
concerns beyond reverting the diff.
