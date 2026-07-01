## Context

Greenfield Chrome MV3 extension (see `openspec/project.md` for tech stack/practices). Two independent systems of record must cooperate:
- `chrome.bookmarks` API — the only source of truth for bookmark/folder structure (titles, URLs, parent/child, existence). Never forked or duplicated locally.
- Extension-owned storage — layout/position and per-item/per-folder settings that Chrome has no concept of.

Everything in this design follows from keeping that boundary strict: the extension reacts to `chrome.bookmarks` events and calls its mutation methods (`move`, etc.), but never treats its own storage as authoritative for structure.

## Goals / Non-Goals

**Goals:**
- Deterministic, reproducible bookmark-icon layout across sessions and tabs.
- Resize behavior that never silently loses a user's manual arrangement.
- Safe handling of user-uploaded icon images.

**Non-Goals:**
- Cross-device sync of layout (only `chrome.bookmarks` structure syncs natively via Chrome; layout is local-only, per profile).
- Editing bookmark content (rename/delete) from the desktop UI — out of scope for this change.
- Any behavior for dragging a folder onto itself/its descendants (cycle) — explicitly out of scope, not handled.

## Decisions

**Position model: per-folder cell coordinate (page, row, col), not pixels.**
Storing pixel positions breaks across window sizes; storing normalized/percentage coordinates still breaks under grid-dimension changes (adding/removing columns). A discrete cell address is the only representation that survives both continuous resize (icon scaling) and discontinuous grid changes (column/row count changes) without ambiguity. Keyed by `(folderId, bookmarkId) → {page, row, col}` in `chrome.storage.local`.

**Placement rule: next-free-cell only; Chrome order used once.**
Every arrival (first run, new bookmark, cross-folder move — including moving back to a previously visited folder) is placed into the next free cell. Chrome's bookmark order is consulted only as the iteration order for the one-time bulk seed of a folder that has no stored positions yet. This was chosen over "always mirror Chrome's order" because it makes every other rule simpler: manual drags are always authoritative and never fight with a live-recomputed order, and Chrome-native reordering (`onMoved` within the same parent) can be ignored outright rather than triggering a re-layout.

**Grid sizing: formula-driven, not breakpoints.**
`cols = floor(availableWidth / cellSize)`, `rows = floor(availableHeight / cellSize)`, where `cellSize` scales continuously up to a configurable max, then pins and lets `cols`/`rows` grow instead. One formula, evaluated on resize, avoids a hand-tuned breakpoint table and generalizes to arbitrary window sizes.

**Column growth backfills (mutates); row growth and all shrinking are display-only (never mutate).**
An explicit, asymmetric product rule (not derived from a generic principle): growing columns pulls items forward from later pages, cascading and potentially collapsing trailing pages — implemented as a dense repack (stable sort by current `(page, row, col)`, reassigned via the new capacity) that **persists** the result, since there's no requirement protecting stored position during growth. Growing rows only exposes empty cells — an intentional no-op, gated by `shouldReflowOnGrowth` (cols must increase; a simultaneous row shrink also skips the mutation, to avoid touching stored position during any shrink). Shrinking either dimension (independently discovered as a requirement conflict during Group 5: "Pinned Position Resilience Under Shrink" explicitly forbids mutating stored position on shrink) is instead a **pure, render-time-only** computation in `paginate()`: items that no longer fit the current capacity are displayed in the lowest free cell in reading order (naturally compacting into same-page gaps before cascading to a later page), without ever writing to storage. Because storage is untouched, growing back to a previously-seen capacity trivially redisplays every item at its true stored cell — no special-casing needed for "resume exact position."

**Grid settings inherit; sidebar-display and label settings don't.**
Grid/layout settings (auto vs. fixed, max icon size, fixed rows×cols) use a folder → nearest ancestor → global-default lookup chain, since layout is naturally a per-branch concern (e.g. one folder wants a dense fixed grid, its children inherit that unless overridden). Per-bookmark label display and per-folder sidebar display are each single, non-inherited values — simpler, and there's no natural "ancestor" default for something scoped to one item.

**Pinned-position resilience under shrink.**
If a stored `(page, row, col)` no longer fits the current grid (e.g. window shrunk), `paginate()` displays it in a compacted/cascaded cell without touching storage; it reappears at its exact stored coordinate once the grid regains capacity, since nothing was ever recomputed or discarded there in the first place (see column-growth-vs-shrink decision above).

**Favicon retrieval via MV3 `_favicon` API.**
`chrome://favicon/<url>` is deprecated/restricted under MV3. Use `chrome-extension://<id>/_favicon/?pageUrl=<url>&size=<n>` with the `favicon` permission declared in the manifest.

**Custom icon uploads: raster-only, validated, safely rendered.**
SVG is excluded entirely (only format capable of embedding executable markup). Accepted formats (PNG/JPEG/WebP/AVIF) are validated by magic-byte signature (not extension/MIME string), capped in file size and pixel dimensions (resource-exhaustion guard), and always rendered via `<img>`/blob URL — never parsed or inlined as markup. Image bytes are stored in IndexedDB (not size-constrained like `chrome.storage.local`'s default quota); `chrome.storage.local` holds only the reference/metadata pointing at the IndexedDB record.

**Live cross-tab sync via two independent event sources.**
Layout/settings changes propagate via `chrome.storage.onChanged` (extension's own storage). Bookmark structure changes propagate via native `chrome.bookmarks.onCreated/onRemoved/onMoved/onChanged` events, which Chrome already delivers to every extension context. No custom messaging/broadcast channel needed — both are already global within the profile.

## Risks / Trade-offs

- **[Risk]** Column-growth backfill cascading through many pages on every resize tick could be expensive for folders with hundreds of bookmarks. → **Mitigation**: debounce/throttle resize-triggered relayout; only recompute cascades once resize settles.
- **[Risk]** Small favicons upscaled to a large max-icon-size will look blurry. → **Mitigation**: accepted trade-off per product decision; custom icon upload is the escape hatch for a crisp look.
- **[Risk]** `chrome.storage.local`'s default quota could still be a constraint even with images moved to IndexedDB (many folders × settings × position entries). → **Mitigation**: position/settings records are small (a few numbers/flags each); monitor usage, request `unlimitedStorage` permission if needed.
- **[Risk]** Asymmetric row/column growth behavior could surprise implementers maintaining this later (col grows pulls content, row grows doesn't). → **Mitigation**: this design doc and the `bookmark-canvas` spec both document it explicitly as intentional, not an oversight.

## Migration Plan

Greenfield — no existing users/data. First run performs the one-time bulk seed (walk each folder's Chrome-order bookmarks into next-free-cells) described above. No rollback concerns beyond standard extension versioning.

## Open Questions

- Exact default values: global max icon size, global default rows×cols for auto mode, minimum icon size floor before fixed-mode scrolling kicks in. Left as tunable constants, not blocking implementation.
- Generic fallback icon (shown when no favicon resolves and no custom icon is set) — visual asset to be supplied by the product owner before ship.
