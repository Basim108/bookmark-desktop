## Context

`resolveTier(availableWidth)` in `src/lib/grid/sizing.ts` is a discrete 3-tier step function keyed on the canvas's own measured available width (`useGridLayout`'s `containerRef`/`useElementSize`), returning both an icon size and a label font-size per tier. Today's breakpoints (1660px, 2100px) mean the largest tier (166px/1rem) only applies above 2100px of canvas width — a wide monitor with a slim sidebar — so most ordinary window widths render at the small or medium tier, which reads as visually undersized.

## Goals / Non-Goals

**Goals:**
- Lower the two breakpoints to 512px and 1024px so the largest tier becomes the default for ordinary window widths, with the two smaller tiers reserved for genuinely narrow canvases.
- Change only the two breakpoint constants — tier icon sizes, tier label font-sizes, and the measurement basis all stay exactly as they are.

**Non-Goals:**
- Not changing what width is measured — this remains the canvas's own available width (window width minus sidebar width), not the raw browser viewport and not the sidebar's own width. This was confirmed explicitly: the alternative (switching to raw window width) was considered and rejected, since it would let a sidebar-only resize shift the grid's tier — an entanglement the original grid-sizing redesign deliberately avoided.
- Not touching the sidebar's own independent width-tiering (`useSidebarResize`, 1024px/1920px) — its `1024` value is a coincidental match with this change's new `LARGE_BREAKPOINT`, not a shared constant or related system.
- Not changing the label-font-size reporting bridge (`Canvas` → `App` → `--label-font-size` CSS variable) — folder labels already track bookmark label font-size via that mechanism and require no changes here.

## Decisions

**1. Change only `MEDIUM_BREAKPOINT`/`LARGE_BREAKPOINT`, nothing else in `resolveTier`.** Alternative considered: also reconsider the tier icon sizes/font sizes themselves while touching this function. Rejected — the values (80px/0.75rem, 106px/0.85rem, 166px/1rem) were deliberately set in the prior two changes and aren't in question here; only the width thresholds at which they apply are changing.

## Risks / Trade-offs

- **[Risk] This is a significant intent flip, not just a numeric tweak.** Under the old breakpoints, the largest tier was the exception (required ≥2100px canvas width); under the new breakpoints, it's the default for nearly any normal desktop window, and the small/medium tiers become the exception (narrow/snapped windows only). → **Mitigation**: this is the explicit, confirmed intent of the change — flagged during exploration and accepted, not an unintended side effect.
- **[Risk] Existing tests hardcode widths inside the old 1660–2100 breakpoint range** (`sizing.test.ts`'s boundary assertions at 1659/1660/2099/2100, and `Canvas.test.tsx`'s two tier-specific tests resizing to 1700 and 2100). → **Mitigation**: update both to use widths inside the new 512–1024 range as part of this change's tasks, consistent with how the prior grid-tier change updated the same test files.
