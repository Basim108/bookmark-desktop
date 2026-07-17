# Design

## Context

The extension treats `chrome.bookmarks` as the source of truth for structure,
but has only ever *read*, *edited* (`edit.ts`), *moved* (`move.ts`), and
*removed* it — never created a bookmark or folder. Positions, per-item settings,
and custom-icon blobs are kept in sync with structure changes by background
listeners in `lib/bookmarks/events.ts`; in particular `onCreated` auto-places
each new bookmark into the next free grid cell (mutex-coordinated), and
`onRemoved` cascades cleanup of a removed subtree's positions/settings/icons.
Custom icons are stored in IndexedDB via `iconDb.putIcon(itemId, blob)`, keyed
by node id, and gated by the `lib/icons/validation.ts` pipeline (magic-byte
format sniff → decode check → size cap). Bookmark URLs are gated everywhere by
`isSafeNavigationUrl`.

uTab exports a JSON object shaped like:

```jsonc
{
  "folders": [
    {
      "name": "Work",
      "preview": "data:image/png;base64,iVBORw0K…",   // folder icon (optional)
      "bookmarks": [
        {
          "title": "Swoogo",
          "url": "https://…",
          "preview": "data:image/png;base64,iVBORw0K…" // bookmark icon (optional)
          // uTab also emits _id, id, icon (remote URL) — ignored
        }
      ]
    }
  ]
}
```

This change adds the extension's first creation path plus a new `bookmark-import`
capability, reusing the existing icon-validation, icon-storage, URL-safety, and
auto-placement machinery rather than duplicating any of it.

## Goals

- Import a uTab JSON export into a user-selected folder from the Folder Settings
  window, recreating its folders, bookmarks, and icons.
- Reuse existing icon validation/storage, URL-safety, and auto-placement.
- Be forgiving of real-world exports: skip individual bad entries and report,
  rather than aborting a whole import over one bad URL or icon.

## Non-goals

- Any import format other than uTab (the dropdown is built to grow, but only
  "Import uTab" ships now).
- De-duplication / merge-on-re-import (v1 always creates fresh items).
- Importing into a folder other than the one whose settings window is open.
- Exporting to uTab or any format.
- Preserving uTab's own grid positions (we let auto-placement lay items out in
  creation order).
- Fetching the remote `icon` URL uTab also emits — we only use the embedded
  base64 `preview`, avoiding any off-device network call.

## Decisions

### Decision 1: Map folder → Chrome subfolder, bookmark → Chrome bookmark

Each uTab `folders[]` entry becomes a Chrome **subfolder created inside the
selected folder**, and its `bookmarks[]` become Chrome bookmarks inside that
subfolder. This preserves uTab's grouping and folder icons, and matches the
extension's model where folders are sidebar-only containers and bookmarks are
the canvas leaves.

```
Selected folder (settings window open on it)
 ├─ [uTab folder "Work"]   (preview → folder icon)
 │    ├─ Swoogo            (preview → bookmark icon)
 │    └─ …
 └─ [uTab folder "Play"]   (preview → folder icon)
      └─ …
```

Rejected: flattening every bookmark directly into the selected folder — it
discards folder names and icons and collapses the user's organization.

### Decision 2: New `create.ts`, gated like `edit.ts`

Add `lib/bookmarks/create.ts` with `createFolder(parentId, title)` and
`createBookmark(parentId, title, url)`. These are the *only* creation wrappers
and apply the same guards `edit.ts` already enforces: title is trimmed and must
be non-empty; a bookmark url must pass `isSafeNavigationUrl` or creation is
refused. Each returns the created `BookmarkTreeNode` — the importer needs the
new id to attach an icon and set the `hasCustomIcon` flag. Keeping creation in
its own module (rather than growing `edit.ts`) mirrors the existing one-concern
-per-file layout under `lib/bookmarks/`.

### Decision 3: Ordering — create first, then icon

An icon can only be stored after its node exists, because `putIcon` keys by the
node's Chrome id. So the per-item sequence is:

```
create node ──▶ node.id ──▶ decode preview data-URL → Blob
                                     │
                        validate (format sniff + decode + ≤1 MB)
                              │ ok                    │ fail / absent
                      putIcon(node.id, blob)          skip icon;
                      setHasCustomIcon(node.id)        node keeps default
```

A folder is created before its bookmarks (its bookmarks need its id as
`parentId`). Within a folder, bookmarks are created in array order so
auto-placement lays them out in the same order uTab listed them.

### Decision 4: Let `onCreated` own placement — don't touch positions

The background `onCreated` listener already assigns each new bookmark the next
free cell in its parent folder, mutex-coordinated, in creation order. The
importer therefore writes **nothing** to the positions store; it just creates
in order and lets placement converge. This keeps a single source of placement
logic and avoids racing the background worker.

Consequence: a bulk import fires one `onCreated` placement write per bookmark.
Chrome's native `onImportBegan`/`onImportEnded` batching (which `events.ts`
already honors) is **not** triggered by programmatic `chrome.bookmarks.create`,
only by Chrome's own HTML-bookmark import — so we don't get free batching here.
At typical uTab export sizes (tens to low-hundreds of bookmarks) the per-item
write is fine. If profiling ever shows this is a problem, a future change could
expose an "import mode" flag that suppresses per-item placement and backfills
once, mirroring the existing `onImportEnded` path — explicitly out of scope now.

### Decision 5: Accept a `Blob` in the icon validator

`validateIconFile` currently takes a `File`. A decoded data-URL is a `Blob`, not
a `File`. Rather than fabricate a `File` wrapper at the call site, widen the
shared `validateImageFile`/`validateIconFile` parameter to `Blob` (a `File`
*is* a `Blob`, so all existing callers keep working). The validator only uses
`.size`, `.arrayBuffer()`, and `createImageBitmap()`, all of which are `Blob`
members — no behavior change for the existing upload paths.

### Decision 6: Skip & report; whole-file failure only for structural errors

Two failure tiers:

- **Structural** (whole import aborts, nothing created): the file is not valid
  JSON, or does not match the uTab shape (no `folders` array, or `folders` is
  not an array). The window shows an error and creates nothing.
- **Per-entry** (skip and continue): a folder with a blank name, a bookmark
  with a blank title or an unsafe url — these entries are skipped. A bad or
  oversized icon is skipped *without* dropping its owning folder/bookmark (the
  item imports with the default icon / favicon). Counts of created folders,
  created bookmarks, and skipped entries are accumulated and shown as a summary
  when the import finishes.

This favors getting a real-world export mostly-imported over failing the whole
thing on one malformed entry, while still refusing a file that clearly is not a
uTab export.

### Decision 7: v1 always creates — no de-duplication

Re-importing the same file creates duplicate folders/bookmarks. Detecting
"already imported" reliably (same url? same url + title? across nested
subfolders?) is a non-trivial design of its own and risks surprising merges.
For v1 the rule is simple and predictable: import always adds. A future change
can layer on url-based skip if users ask for it.

### Decision 8: Dropdown built to grow, ships with one item

"Import Bookmarks" is a dropdown even though it has a single "Import uTab" item
today, so adding other formats later (e.g. a browser HTML export) is a menu
addition, not a UI redesign. It lives in `FolderSettingsWindow` beside the
existing image controls, styled to match.

## Risks / Open Questions

- **Large files / many icons.** A big export embeds many base64 images; decoding
  and validating each (including `createImageBitmap`) is work. Typical exports
  are small (the sample is ~33 KB), but a very large file could make the window
  briefly unresponsive. Acceptable for v1; could move decoding off the main
  thread later if needed. Worth a sane upper bound on total file size.
- **Partial import on unexpected failure.** Skip-and-report means a run can
  create some items and skip others by design. If an *unexpected* error throws
  mid-run (e.g. a `chrome.bookmarks.create` failure), items already created stay
  created — there is no transactional rollback across many API calls. The
  summary should reflect what actually got created rather than implying
  all-or-nothing.
- **uTab format drift / unknown fields.** We map only `name`, `preview`,
  `bookmarks[].title/url/preview` and ignore everything else (`_id`, `id`,
  `icon`). If a uTab version nests folders or renames fields, the importer would
  silently skip them; the sample export is flat (folders → bookmarks only). Flag
  if deeper nesting turns out to exist.
- **Icon key collision on re-import.** Icons key by the *new* node id, which
  Chrome guarantees unique, so re-import duplicates get distinct icon keys — no
  collision. Removal already cascades icon cleanup via `onRemoved`.
