## Context

The active folder is `App.tsx`'s `selectedFolderId` — a `useState<string | undefined>(undefined)` whose absence is interpreted at render time as "the first root folder":

```ts
const [selectedFolderId, setSelectedFolderId] = useState<string | undefined>(undefined);
const activeFolderId = selectedFolderId ?? rootFolders[0]?.id;
```

Sidebar expansion is separate and even more local: each `FolderTreeNode` owns `const [expanded, setExpanded] = useState(false)`. Nothing above a node can influence it, so no caller can open a path through the tree.

Two properties of the current code shape this design:

- **Selection resolves synchronously during render.** Restoration is a `chrome.storage.local` read, which is async. Naively adding it produces a first paint on the first root folder followed by a jump — on the single most frequently viewed surface in the product.
- **Expansion is unreachable from outside a node.** Revealing a restored folder requires lifting expansion into `Sidebar`. This refactor is unavoidable and is the bulk of the change's blast radius.

`getFolderAncestorChain(folderId)` already exists in `src/lib/bookmarks/read.ts` (written for settings inheritance). It walks `parentId` upward to but not including the tree root `"0"`, returning `[folderId, ...ancestors]` — exactly the walk the reveal needs, with the restored folder itself as element 0.

The rest of the extension synchronises aggressively: `chrome.bookmarks` events fan out to every context, and `subscribeToBookmarkChanges` makes every open tab refetch. This change deliberately does not follow that pattern.

## Goals / Non-Goals

**Goals:**

- A newly opened new-tab page becomes active on the folder the user most recently selected, surviving tab closure and browser restart.
- The restored folder is visible in the sidebar without the user expanding anything.
- No flash of the wrong folder's bookmarks on load.
- A stored folder that no longer resolves degrades to today's behaviour rather than breaking the page.

**Non-Goals:**

- Propagating the active folder to already-open tabs. Explicitly rejected.
- Persisting sidebar expansion state as its own concern. Expansion is derived from the restored folder and nothing else.
- Per-tab or per-window last folders. There is exactly one recorded value per profile.
- Syncing the last folder across machines. `chrome.storage.local` is local by design, and bookmark ids are not stable across profiles anyway.
- Cleaning up the stored value when its folder is deleted. Handled by read-time validation instead.

## Decisions

### Write on selection, read only at mount

Selecting a folder writes `lastFolderId`; a page reads it exactly once, at mount. No `chrome.storage.onChanged` subscription is registered for this key.

*Why:* a new-tab page is frequently parked and returned to. Having a background tab silently re-navigate to a folder chosen elsewhere is hostile — the user returns to a page that is no longer where they left it. Write-only also removes all cross-tab coordination: no listener, no messaging, no reconciliation of competing selections. Last write wins globally, which is precisely "the last folder I opened".

*Alternative rejected:* write-through with a `storage.onChanged` listener, matching the extension's prevailing live-sync pattern. Rejected on UX grounds, and the resulting exception is written into the spec as a `SHALL NOT` so a future reader does not "correct" it toward the house pattern.

### Only explicit user selection writes

Restoration does not re-write the value it just read, and a fallback to the first root folder does not write either.

*Why:* the fallback case matters. After a state-transfer import — or on a profile where Chrome sync reassigned ids — the recorded id stops resolving. If the fallback wrote itself back, opening one tab would silently erase the real recorded folder, and it could never recover if the id later resolved again. Treating the store as write-on-intent keeps "last opened folder" meaning "the last folder the user chose".

### A new top-level `lastFolderId` key, not a field on `GeneralSettings`

*Why not `GeneralSettings`:* two independent objections.

1. `setCanvasBackground` (`generalSettings.ts:26`) is a read-modify-write over the whole settings object. Folder selection is a high-frequency write. A click landing between the Settings window's read and its write clobbers one of the two. A separate key has no shared record to race over.
2. `GeneralSettings` is user-configured preference data, and `state-transfer` exports it wholesale. Session state riding along in that object would restore one machine's cursor position on another.

*Alternative considered:* a `uiState` object for future session-scoped values. Rejected as speculative — one key is enough, and inventing a container now would repeat the read-modify-write shape this decision exists to avoid.

### Validate at read, not on bookmark removal

The read helper resolves the id via `chrome.bookmarks.get`, catching rejection for unknown ids, and additionally checks `isFolder()` on the result. Anything else falls back.

*Why not cleanup in `events.ts`:* `onRemoved` cleanup would handle deletion but not the more interesting case — a profile where every id was reassigned (Chrome bookmark sync, or a state-transfer import), where no removal event ever fires locally for the old id. Read-time validation covers both with one code path and no service-worker involvement. The cost is one extra `chrome.bookmarks.get` per page load, alongside the tree reads already happening.

The `isFolder()` check is not paranoia: the stored string is an opaque Chrome id, and after ids are reassigned it can legitimately resolve to a bookmark. Rendering the canvas for a bookmark id would show an empty folder with no explanation.

### Gate the canvas on restoration, not the whole page

`AppContent` tracks restoration as an explicit tri-state rather than a bare `string | undefined`, because "not yet restored" and "restored to nothing" must render differently:

```
  restoring          → render sidebar chrome, no canvas
  restored(folderId) → render canvas for folderId
  restored(none)     → fall back to rootFolders[0], or the empty-state message
```

*Why gate only the canvas:* `useSubfolders(ROOT_FOLDER_ID)` already gates the sidebar behind its own `loading`, and both reads start at mount and resolve together. The added latency is one `storage.local` read plus one `bookmarks.get` — effectively nothing, and overlapped with work already in flight. Blocking the entire app would make the sidebar appear later than it does today for no benefit.

### Expansion is a seed, not an invariant

`Sidebar` owns `expandedIds: Set<string>`. It is initialised once, from `getFolderAncestorChain(restoredId).slice(1)` — dropping element 0, the restored folder itself. Afterwards it is ordinary user-driven state.

*Why seeding is sufficient:* a folder can only be clicked if its row is visible, which means its ancestors are already expanded. So any selection made during the session already satisfies the reveal invariant, and no recomputation is needed. This is a real property of the tree UI, not an approximation.

*Why not re-derive on every render:* it would pin the active folder's ancestors permanently open, making the collapse toggle inoperative on exactly the path the user is working in.

*Why `.slice(1)`:* the goal is "reveal where I am", not "open everything near me". Expanding the restored folder's own children adds rows the user did not ask for and pushes its neighbours off-screen.

*Alternative rejected:* persisting the expanded set. More faithful to the tree the user left, but it accumulates ids of deleted folders forever, needs its own cleanup or validation pass, and can restore a sprawling tree that buries the active row — the opposite of the goal. The user chose reveal-only.

### Lifting expansion into `Sidebar`

`FolderTreeNode` takes `expandedIds: Set<string>` and `onToggleExpand: (folderId: string) => void` and drops its `useState`. `Sidebar` holds the set; `App` passes only the seed.

*Why `Sidebar` and not `App`:* `Sidebar` already owns exactly this shape of cross-node state in `openWindow` ("one window open across the whole sidebar"), so the pattern and the prop-drilling path already exist. Expansion is sidebar-internal; `App` has no use for it.

*Note:* `FolderTreeNode` currently self-expands after creating a subfolder (`onSaved={() => setExpanded(true)}`, line 175). That call site must become `onToggleExpand`-based or an explicit expand callback — it is behaviour covered by an existing `folder-sidebar` requirement ("Saving expands the parent to reveal the new subfolder") and must not regress.

## Risks / Trade-offs

- **The `FolderTreeNode` refactor touches every folder row and its tests.** → The prop change is mechanical and type-checked; `tsc --noEmit` finds every call site. The one behavioural call site (post-create expand) is named above and is already spec-covered, so a regression there fails an existing requirement rather than slipping through.

- **Restoration flash if gating is done wrong.** → Specified as its own scenario ("No canvas content is shown before restoration resolves") so it is a test, not a code-review hope. The tri-state makes the wrong rendering hard to write by accident, since there is no `undefined` to fall through on.

- **One extra `chrome.bookmarks.get` on every new-tab load.** → Negligible, and overlapped with the existing tree read. Accepted in exchange for deleting a whole class of stale-state cleanup.

- **After a state-transfer import, the recorded folder will almost always be stale**, since import reassigns every id. → Falls back to the first root folder — the same experience as today, and self-correcting the moment the user selects anything. Deliberately not repaired during import: matching the old folder by structural position would mean teaching the importer about session state it is specified not to carry.

- **Users with several parked new-tab pages get divergent views** — each shows whatever it restored at its own open time. → This is the chosen semantic, not a defect. The alternative was tabs re-navigating underneath the user.

- **"Last opened folder" is global, so a folder selected in a rarely used tab overwrites the value.** → Inherent to a single recorded value; per-tab or per-window scoping was ruled out as a non-goal. Last write wins is the model the user described.

## Open Questions

None. Multi-tab semantics, the expansion model, storage location, and the export exclusion were all settled before this document was written.
