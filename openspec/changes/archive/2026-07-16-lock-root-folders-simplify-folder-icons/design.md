## Context

The folder sidebar currently supports a per-folder three-way display mode and
treats Chrome's protected root folders as fully interactive rows. This change
locks down root folders and collapses the display mode to a single "icon +
name" presentation with a shared default-icon fallback. The decisions below
record the non-obvious choices.

## Decision 1 — "Root folder" = depth-0 row

The sidebar renders `rootFolders` = the direct children of Chrome's tree root
`"0"`, i.e. Bookmarks Bar (`"1"`), Other Bookmarks (`"2"`), Mobile Bookmarks
(`"3"`). These are exactly the rows `FolderTreeNode` renders at `depth === 0`,
and exactly the ids already listed in `PROTECTED_ROOT_FOLDER_IDS`.

We gate the new UI behavior on **`depth === 0`** in `FolderTreeNode` rather
than on an id set. It's the value already in scope, needs no async lookup, and
matches how the tree is actually rendered (the top level is always the roots).
`PROTECTED_ROOT_FOLDER_IDS` in `dragResolve.ts` stays as the server-side-style
guard of last resort.

## Decision 2 — Roots: not draggable, still droppable

The request is "root folders should not be able to be dragged and dropped
anywhere" — i.e. remove the **drag-source** behavior. Dropping *into* a root
(moving a bookmark into Bookmarks Bar) stays useful and is kept.

```
                        depth 0 (root)     depth > 0 (normal)
  gear (settings)       ✕ not rendered     ✓
  useDraggable          ✕ not wired        ✓  (drag source)
  useDroppable          ✓ kept             ✓  (drop target)
```

Implementation: when `depth === 0`, don't call `useDraggable` / spread its
`listeners`+`attributes` onto the row, and don't render the gear button. The
`useDroppable` wiring is unchanged, so `isOver` highlighting and bookmark/
folder drops into roots keep working.

Because roots can no longer be dragged, the existing `dragResolve.ts` guard
`PROTECTED_ROOT_FOLDER_IDS.has(activeId)` becomes unreachable for roots in
practice, but is retained as defense-in-depth (e.g. a drag initiated by other
means, or a future entry point).

## Decision 3 — Default folder icon: one shared IndexedDB record

Custom folder icons already live in IndexedDB (`iconDb`) as raw
`ArrayBuffer` + MIME type, keyed by folder id, rendered by `CustomIconImage`
via an object URL. The default icon reuses that exact pipeline:

- Stored **once** under a reserved well-known key
  (e.g. `"__default_folder_icon__"`) that cannot collide with Chrome's numeric
  bookmark ids.
- Seeded on first run: fetch the bundled `folder.png`, and if no record exists
  under the well-known key, `putIcon(DEFAULT_KEY, blob)`.
- All folders without a custom icon render the *same* record — no per-folder
  duplication, satisfying "there might be several folders that do not have
  icons".

`FolderTreeNode` chooses the key to hand `CustomIconImage`:

```
iconKey = settings.hasCustomIcon ? folder.id : DEFAULT_KEY
```

This is why `hasCustomIcon` is retained: it selects the key up front with no
extra async round-trip and avoids a default→custom "flash".

**Alternatives considered:**
- *Bundled `<img src>` asset for the default* — simplest, but forks the render
  path (asset for default, object-URL for custom) and isn't swappable later.
- *base64 in `chrome.storage.local`* — matches an early instinct, but adds a
  second storage system and a base64-decode render path distinct from how
  custom icons are stored. Rejected in favor of the uniform IndexedDB path.

**Seed timing / robustness:** the seed is async, so on the very first load a
default-icon row could briefly render nothing before the record lands. Options:
(a) accept the one-time blank flash; (b) have the default-icon render fall back
to the bundled asset until the record exists. (a) is the default; (b) is a
small optional hardening if the flash is objectionable in practice.

## Decision 4 — Keep `FolderSettings`, drop only `sidebarDisplay`

`FolderSettings` shrinks from `{ sidebarDisplay, hasCustomIcon }` to
`{ hasCustomIcon }`. The `folderSettings` storage key, its module, and the
`useFolderSettings` hook all remain — they're the natural home for per-folder
name/icon state today and for whatever per-folder settings come next.

Removed as dead code once the display mode is gone:
- `FolderSidebarDisplay` type
- `resolveFolderDisplay()` (no clamping needed — the row always shows an icon)
- `setFolderSidebarDisplay()` and the settings window's clamp-to-label-only
  branch on save

`setFolderHasCustomIcon` simplifies to just writing the flag (it no longer has
to also reset `sidebarDisplay`).

## Decision 5 — Migration is non-destructive

Existing users have `folderSettings` records shaped `{ sidebarDisplay,
hasCustomIcon }`. After this change, reads destructure only `hasCustomIcon`;
the stale `sidebarDisplay` field is ignored and harmlessly overwritten the next
time the record is written. No migration pass, no data loss. Existing custom
icons in IndexedDB are untouched.

## Settings window preview

With the display mode gone, the settings window preview shows: the staged
upload if one exists, else the folder's existing custom icon if it has one,
else the **default folder icon** — so the preview always reflects what the row
will actually render. This replaces the current empty `favicon-fallback` span
shown when no image is staged.
