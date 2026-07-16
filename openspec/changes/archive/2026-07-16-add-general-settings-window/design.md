# Design

## Context

The extension already has two modal settings surfaces — `EditBookmarkWindow`
and `FolderSettingsWindow` — both centered, portaled to `document.body`, with a
titlebar (title + ✕), an opaque body, a footer with Save, and staged edits
applied only on Save. Both already duplicate that modal shell. This change adds
a third, global settings surface and its first setting (canvas background),
following the same patterns, and lays a small foundation (`generalSettings`
object) for future global settings.

## Goals

- A "Settings" modal reachable from the sidebar, not tied to any folder/bookmark.
- A canvas background setting: upload an image, remove it, choose its fit.
- An extensible storage shape so later global settings don't force a migration.

## Non-goals

- Loading a background from a remote URL (dropped: avoids a per-tab network call
  to a third-party host and any CSP dependency).
- Extracting a shared modal-shell component (deferred; see Decision 2).
- Applying the background to the sidebar or the whole window (canvas only).
- Per-folder backgrounds (this is a global setting).

## Decisions

### Decision 1: Sidebar header band outside the scroll area

The hamburger button lives in a new `.sidebar-header` element rendered inside
`Sidebar`, above `.sidebar-scroll-area`, not as a row inside `.folder-tree`.

```
┌─ .sidebar ─────────────────────┐
│  ┌─ .sidebar-header ────────┐   │  fixed; does not scroll
│  │  (logo)          ☰       │   │  ☰ pinned top-right
│  └──────────────────────────┘   │
│  ┌─ .sidebar-scroll-area ───┐   │
│  │  ▸ 📁 folder tree…       │   │  scrolls
│  └──────────────────────────┘   │
└─────────────────────────────────┘
```

- **Why:** it stays put while the folder tree scrolls; it avoids adding a
  non-folder `<li>` to `.folder-tree`, whose spec is deliberate about native
  folder order and the absence of list markers. The "empty folder row" look from
  the reference screenshot is a visual target met with header styling, not a
  folder-tree row.
- **Alternative rejected:** a fake first row inside `.folder-tree` — scrolls
  away with the list and muddies the folder-tree semantics.

### Decision 2: Clone the modal shell, don't extract

`GeneralSettingsWindow` copies the modal structure (backdrop, portal, titlebar
with ✕, Escape handler, footer) with its own `general-settings-window-*`
classes, mirroring how `FolderSettingsWindow` and `EditBookmarkWindow` already
each carry their own copy.

- **Why:** fastest, zero risk to the two existing windows, keeps the change
  tightly scoped and reviewable.
- **Tradeoff:** three copies of the modal shell now exist. Extracting a shared
  `ModalWindow`/`SettingsWindow` shell is a worthwhile follow-up, tracked
  separately — not bundled here.

### Decision 3: `generalSettings` object, not a single-purpose key

A new chrome.storage.local key holds an object, so future global settings are
added as fields rather than new top-level keys.

```ts
interface GeneralSettings {
  background:
    | { kind: "none" }
    | { kind: "upload"; fit: "cover" | "contain" | "center" };
}
```

- The uploaded image's **bytes** live in IndexedDB under the reserved key
  `__canvas_background__` (mirroring `DEFAULT_FOLDER_ICON_KEY`), reusing
  `iconDb` put/get/delete. The `generalSettings` object holds only the metadata
  (whether a background exists, and its fit mode) so the canvas can decide what
  to render without an async IndexedDB read blocking layout.
- **Why keep bytes out of chrome.storage.local:** same rationale as icons —
  large binary belongs in IndexedDB, and chrome.storage.local has tight quotas.

### Decision 4: Background applies to `.canvas`, fit is configurable

The background is set on the `.canvas` element only. `background-repeat` is
always `no-repeat`; `background-size`/`background-position` derive from fit:

| Fit | background-size | background-position |
|---|---|---|
| cover (default) | `cover` | `center` |
| contain | `contain` | `center` |
| center | `auto` | `center` |

- A small `useCanvasBackground` hook reads `generalSettings` + the IndexedDB
  blob, creates an object URL, and returns the style values for `.canvas`. It
  **owns the object-URL lifecycle**: revoking the previous URL when the
  background changes and on unmount (a CSS `background-image` has no unmount hook
  of its own, unlike the `<img>` in `CustomIconImage`).
- The hook subscribes via `onStorageKeysChanged(["generalSettings"], …)` so a
  change in one tab re-reads and re-applies live in every open tab, consistent
  with `sidebarWidth` and folder/bookmark settings.

### Decision 5: Separate 10 MB background validator

Add `validateBackgroundFile` in `src/lib/icons/validation.ts`, reusing the
existing magic-byte format sniffing (png/jpeg/webp/avif; SVG rejected) and the
`createImageBitmap` decode check, but with a `MAX_BACKGROUND_FILE_SIZE_BYTES`
of 10 MB.

- **Why a separate function, not a parameterized `validateIconFile`:** the two
  limits (1 MB icons, 10 MB backgrounds) stay independently obvious at each call
  site, and the icon path is unchanged.

## Staging model (mirrors FolderSettingsWindow)

```
type PendingBackground =
  | { kind: "unchanged" }
  | { kind: "upload"; file: File; previewUrl: string }
  | { kind: "removed" };
```

- Fit is separate window state, seeded from the saved fit (default cover).
- On **Save**: if upload → `putIcon(__canvas_background__, file)`; if removed →
  `deleteIcon(__canvas_background__)`; then write the `generalSettings.background`
  metadata (`{ kind: "upload", fit }` or `{ kind: "none" }`).
- Close / Escape / backdrop → discard staged state; the staged upload's object
  URL is revoked on unmount.

## Risks / edges

- **Object-URL leaks** if the hook forgets to revoke on change/unmount — covered
  by the hook owning the lifecycle explicitly.
- **First-paint flash:** the canvas may paint once before the async IndexedDB
  read resolves; acceptable and self-heals on the next paint (same tolerance as
  `seedDefaultFolderIcon`).
- **Removing the background** must both clear the IndexedDB record and set
  `background` to `{ kind: "none" }`, so a stale blob is never left behind.
