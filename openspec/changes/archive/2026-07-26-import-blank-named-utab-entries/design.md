# Design — import-blank-named-utab-entries

Thread 1 of `openspec/changes/rework-utab-import/design.md`, now fully settled.
That document holds the exploration and the measurement; this one holds only
what an implementer needs.

## The two substitutions

```
  utab.ts, per folder
    │
    ├─ blank name ────────────▶ name := "New Folder"
    │
    └─ createFolder(targetId, name)          ← guard unchanged; now never rejects

  utab.ts, per bookmark entry
    │
    ├─ no url ────────────────▶ empty slot: ignore   (ignore-utab-empty-slots)
    │
    ├─ blank title ───────────▶ title := url
    │
    ├─ createBookmark(folderId, title, url)  ← guard unchanged; url safety still
    │                                          applies and can still reject
    │
    └─ on success, if the title was substituted:
           setBookmarkLabelDisplay(node.id, "tooltip")
```

**Order is load-bearing.** The empty-slot check must precede the title
fallback. Reversed, every placeholder gets `title := ""`, stays blank, and the
758 noise rows come back — or worse, if the predicate ever loosens, gets
created as a junk bookmark.

**The url-safety check still runs after the substitution.** Substituting the
url into the title does not smuggle it past `isSafeNavigationUrl` —
`createBookmark` validates `url` independently of `title`. A blank-titled
`javascript:` entry is still rejected as `unsafe-url`. This is the boundary the
tests must pin.

## Decisions and why

**Full url, not hostname.** Two of the 25 rescued entries are
`https://hrimsoft.atlassian.net/jira/software/projects/HC/boards/1` and
`https://hrimsoft.atlassian.net/wiki/spaces/HRIMCALEND/pages/65566/…`. Same
host, different paths. A hostname title renders them identically, which is the
exact confusion the fallback exists to prevent. The counter-argument — a full
url reads badly as a hover tooltip — is accepted as the lesser cost: an ugly
tooltip beats two identical ones. No truncation, for the same reason: the url
is the only identifying information the entry has.

**`labelDisplay: "tooltip"`, not a shortened label.** The default is
`"under-icon"` (`DEFAULT_BOOKMARK_SETTINGS`, `bookmarkSettings.ts:5`), which
would put a raw url under every rescued icon. `"tooltip"` is the existing,
user-facing mode for exactly this — a bookmark whose name should not be shown
on the canvas — reachable today from the Edit Bookmark window's checkbox. The
user can flip it back per bookmark with no import-specific machinery.

**`"New Folder"` as the folder default.** Already this app's term for an
unnamed folder: the heading of the create-folder draft window
(`FolderSettingsWindow.tsx:330`). Duplicates are permitted and expected — three
blank folder names produce three folders called `"New Folder"` — which is
consistent with the existing "Import Always Creates New Items" requirement that
import never de-duplicates.

**Substitute in the importer, not in the creation functions.**
`createBookmark`'s and `createFolder`'s `empty-title` guards mirror
`updateBookmark` and `updateFolderTitle` and serve the manual add/edit forms as
well as the importer. An empty name in the New Folder dialog should stay
rejected so the user types one — it must not quietly become `"New Folder"`.
Relaxing a shared guard to serve one caller would change behaviour in a UI
nobody asked to change.

## Consequences an implementer will hit

**`empty-title` becomes unreachable from the uTab importer.**

- *Folder path:* immediately and unconditionally — `createFolder` returns
  `ok: false` only for `empty-title`, so once it is never handed a blank name,
  its failure branch (`utab.ts:151-173`) cannot be taken at all. A
  `chrome.bookmarks.create` rejection goes to the `fatal` path, not here.
- *Bookmark path:* only once `ignore-utab-empty-slots` has landed. Until then a
  url-less entry still yields `title := "" ` and is still rejected as
  `empty-title`.

Two follow-ons:

- The dead `createFolder` failure branch takes every `parent-skipped` row with
  it. Delete it deliberately or keep it defensively — but decide, and say which
  in a comment, because a reader will otherwise assume it still fires.
  `parent-skipped` stays in the shared `SkipReason` union: state-transfer still
  emits it.
- `reasonForCreateError` (`utab.ts:112`) maps `empty-title` → `empty-title` and
  everything else → `unsafe-url`. With `empty-title` unreachable it always
  returns `unsafe-url`. Simplify it or keep it total — but do not leave a branch
  that can no longer be taken looking live.

**The `SkipReason` note needs updating, not just the code.**
`add-utab-import-report` deliberately left a note on that type saying
`empty-title` "goes dead for uTab once the blank-title fallback lands". This is
that change. Turn the prediction into a statement of fact rather than leaving a
reader to wonder whether it happened.

**Writing `labelDisplay` is a read-modify-write on the whole bookmark-settings
map.** `setBookmarkLabelDisplay` reads all settings, merges one entry, writes
all back — the same shape as the positions bug fixed by
`make-position-writes-atomic`. It is safe here only because import is
sequential (a deliberate, preserved property) and because nothing else writes
`bookmarkSettings` during an import: the service worker only ever *removes*
entries, on bookmark removal. The importer already does exactly this per icon
via `setBookmarkHasCustomIcon`, so this adds a second call of an existing
pattern rather than a new hazard. Worth knowing before anyone parallelizes the
import loop — that would break both.

## Scope

25 bookmarks in the measured export, plus however many blank-named folders a
given export has (zero in the measured one — all 12 folders imported). The
folder half fixes a case the user has not hit yet but that loses a whole
subtree when it does.

## Measured outcome

Running the implemented importer against the real export
(`design/examples/uTab_settings_26-07-2026.json`), on top of
`ignore-utab-empty-slots`:

| | original | after empty-slots | after this change |
| --- | ---: | ---: | ---: |
| bookmarks created | 213 | 213 | **238** |
| skipped (summary) | 783 | 25 | **0** |
| report rows | 789 | 31 | **6** |
| `skipped` / `empty-title` | 783 | 25 | 0 |
| `warning` / `icon-failed` | 6 | 6 | 6 |

All 25 previously lost bookmarks now import — 238 created against 238 real
entries in the file — and exactly 25 carry `labelDisplay: "tooltip"` while the
other 213 keep the `"under-icon"` default, confirming the setting is written
only for substituted titles. Sample rescued titles:
`https://app.clockify.me/tracker`, `https://learn.epam.com/`,
`https://www.whizlabs.com/pricing/`.

The report is down to the 6 `icon-failed` warnings — the only thing left in it
is the diagnostic gap recorded as question 6 in `rework-utab-import/design.md`
(those rows still carry an empty `error` column).

The folder fallback is not exercised by this export: all 12 folders had names,
and all 12 kept them. It is covered by unit and e2e tests instead.

## Out of scope, deliberately

- **Url safety stays as-is.** `javascript:`, `data:`, `chrome://`, `file:`, and
  scheme-less `google.com` all remain rejected. Zero `unsafe-url` skips were
  measured, so there is no benefit to set against loosening a security
  allowlist. The proposed `unsafe-url` reason split is dropped with it.
  `e2e/import-utab.spec.ts:151` asserts the scheme-less case and must keep
  passing unchanged.
- **Blank titles on entries with no url** — empty grid slots, owned by
  `ignore-utab-empty-slots`.
- **The empty `error` column on `icon-failed` rows**, and **`_id` not being an
  opaque key** (uTab's seeded defaults use their url as `_id`; `lEt1g9gkJ7zLNX`
  repeats across two folders). Both recorded as questions 6 and 7 in
  `rework-utab-import/design.md`; neither is claimed by any change yet.
