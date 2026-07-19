# state-transfer Specification

## Purpose
Exporting the entire extension state — the bookmark tree plus its side-car layer
(grid positions, per-item settings, per-item and global custom icons, general
settings, sidebar width) — to a single self-contained, id-free, versioned JSON
file, and importing such a file with a replace strategy. Because Chrome bookmark
ids are not stable across profiles, the file embeds all state inline in the tree
(keyed by structural position, not id) so it can be restored after Chrome
reassigns every id. Import runs under a lock that suspends the normal
bookmark-sync listeners, restores each root without ever emptying it, and reports
entries it could not recreate.

## Requirements

### Requirement: Export Entire Extension State to a JSON File
The system SHALL provide a way to export the entire extension state to a single
JSON file downloaded to the user's local machine. The exported file SHALL
contain: the full bookmark tree under each protected root (Bookmarks Bar, Other
Bookmarks, Mobile) with every folder and bookmark's title and (for bookmarks)
url; every folder's settings and custom icon; every bookmark's grid position,
settings, and custom icon; and the general block — the general-settings object,
the sidebar width, and the two global reserved-key images (canvas background and
default folder icon). Custom icons and global images SHALL be inlined as base64
image data URLs so the file is self-contained. The file SHALL NOT be transmitted
off-device; it is written locally.

#### Scenario: Export produces a single self-contained file
- **WHEN** the user exports the extension state
- **THEN** one JSON file is downloaded locally containing the bookmark tree, per-folder and per-bookmark settings, grid positions, all custom icons and global images inlined as base64, and the general settings — with no reference to any external file

#### Scenario: Export file is named by timestamp
- **WHEN** the user exports the extension state
- **THEN** the downloaded file is named in the format `YYYY-MM-DD-HH-mm-bookmark-desktop.json`

### Requirement: Id-Free, Versioned Export Format
The exported file SHALL embed each item's state inline within its node in the
bookmark tree, keyed by structural position rather than by any Chrome bookmark
id, so it can be restored after Chrome reassigns ids. The top level SHALL group
nodes under the well-known protected-root ids (`1`, `2`, `3`), and each such root
SHALL record its display title as read from the live bookmark tree. The file
SHALL carry a format `version` string in `x.y.z` form, stamped from a single
source-of-truth constant, where `x` denotes a breaking format change, `y` an
additive feature, and `z` a bug fix.

#### Scenario: No Chrome ids appear as state keys
- **WHEN** the extension state is exported
- **THEN** each folder's and bookmark's settings, position, and icon are stored inline on that node, and no part of the file keys state by a Chrome-assigned bookmark id

#### Scenario: Each root records its title
- **WHEN** the extension state is exported
- **THEN** each protected root in the file carries its display title (e.g. the Bookmarks bar's title) as read from the live bookmark tree

#### Scenario: File carries a semantic version
- **WHEN** the extension state is exported
- **THEN** the file includes a `version` field in `x.y.z` form matching the exporter's current format-version constant

### Requirement: Import Accepts Only Parseable JSON of a Compatible Major Version
The system SHALL provide a way to import a previously exported file chosen from
the local machine. The system SHALL validate only that the chosen file is
parseable JSON carrying a `version` field; it SHALL NOT perform JSON-Schema
validation. If the file is not parseable JSON, or lacks a valid `x.y.z`
`version`, or its major version differs from the importer's format-version
major, the system SHALL deny the import, notify the user, and change nothing.

#### Scenario: Non-JSON file is denied
- **WHEN** the user chooses a file that is not parseable JSON
- **THEN** the import is denied with an error and no bookmarks or settings are changed

#### Scenario: Older major version is denied
- **WHEN** the chosen file's major version is lower than the importer's
- **THEN** the import is denied and the user is told the backup uses an older format that this version can no longer import

#### Scenario: Newer major version is denied
- **WHEN** the chosen file's major version is higher than the importer's
- **THEN** the import is denied and the user is told the backup was made by a newer version and to update the extension

#### Scenario: Same major version proceeds
- **WHEN** the chosen file is parseable JSON whose major version equals the importer's
- **THEN** the import proceeds regardless of its minor or patch version

### Requirement: Backup Prompt Before a Destructive Import
Before any existing data is deleted, the system SHALL prompt the user to back up
the current bookmarks and state. If the user confirms, the system SHALL run the
export first (downloading a current-state backup file) before proceeding with
the import. If the user declines, the import SHALL proceed without a backup. If
the user cancels, the import SHALL NOT proceed and nothing SHALL be changed.

#### Scenario: Confirming the backup exports current state first
- **WHEN** a valid import is started and the user confirms the backup prompt
- **THEN** the current extension state is exported and downloaded before any deletion or creation occurs

#### Scenario: Declining the backup proceeds without one
- **WHEN** a valid import is started and the user declines the backup prompt
- **THEN** the import proceeds and no backup file is produced

#### Scenario: Cancelling the prompt aborts the import
- **WHEN** a valid import is started and the user cancels the backup prompt
- **THEN** nothing is deleted or created and the extension state is unchanged

### Requirement: Replace-Strategy Restoration

On a confirmed import the system SHALL replace, not merge. For each protected
root it SHALL restore the file's content by creating the new children **before**
deleting the previously existing ones, so that a root being restored into never
becomes empty during the import. This is required because Chrome does not keep a
non-permanent root (the Mobile bookmarks root) once it is emptied; creating first
keeps it alive so its contents can be restored. The system SHALL never delete the
protected roots (`0`, `1`, `2`, `3`) themselves. Each recreated node SHALL be
assigned its state (position, settings, custom icon) under the new Chrome id that
Chrome assigns on creation. When the file has no content for a root, that root's
existing children SHALL still be removed (replace strategy). Because the replace
deletes the folder the new-tab view may currently be showing, the system SHALL
NOT surface a stale bookmark-id error when the replaced tree is read back, and
the new-tab view SHALL end on the restored tree with a valid selection.

The replace SHALL extend to the stored data that describes the replaced tree, not
only to the bookmark nodes themselves. Because the import lock deliberately
suspends the per-item removal cleanup that would normally garbage-collect this
data, the importer SHALL take responsibility for it: after the per-root
create-before-delete pass and while the lock is still held, the stored grid
positions, bookmark settings, and folder settings SHALL be left containing
exactly the entries the import wrote, and custom-icon records SHALL be left
containing exactly the icons the import wrote plus the reserved global keys.
Stored data belonging to the replaced tree SHALL NOT survive the import.

#### Scenario: A non-permanent root's content is restored, not lost to emptying
- **WHEN** the file has content for the Mobile bookmarks root and that root exists at import time
- **THEN** its new children are created before its old ones are deleted, so the root is never emptied and its content is restored (not dropped)

#### Scenario: Old content is replaced by the file's content
- **WHEN** an import is confirmed and begins
- **THEN** for each root the previously existing children are removed and the file's children are created under it, while the protected roots themselves remain

#### Scenario: The file's tree is recreated under the same roots
- **WHEN** the recreate phase runs
- **THEN** each node from the file is created under the root it was exported from, carrying its title and (for bookmarks) url

#### Scenario: State is restored under the new ids
- **WHEN** a folder or bookmark is recreated
- **THEN** its exported settings, grid position (for bookmarks), and custom icon are stored keyed by the new Chrome id, so the restored desktop matches the exported one

#### Scenario: Replacing the currently viewed folder does not raise a stale-id error
- **WHEN** the folder the new-tab view is showing is deleted by the replace and the view reads it back
- **THEN** no "can't find bookmark for id" error is raised, and after the import the view shows the restored tree

#### Scenario: The replaced tree's stored settings do not survive the import
- **WHEN** an import completes over a tree that had stored grid positions, bookmark settings, and folder settings
- **THEN** those stores hold exactly the entries the import wrote, and no entry keyed by an id from the replaced tree remains

#### Scenario: The replaced tree's custom icons do not survive the import
- **WHEN** an import completes over a tree whose items had custom icon records
- **THEN** the icon store holds exactly the icons the import wrote, and the replaced tree's icon records are gone

#### Scenario: Reserved global icon keys survive the sweep
- **WHEN** the importer sweeps unreferenced icon records
- **THEN** the reserved global keys (the default folder icon and the canvas background) are preserved and set from the file's general block, not deleted as unreferenced

#### Scenario: Repeated imports do not accumulate orphaned data
- **WHEN** several imports are run in succession over each other
- **THEN** the stored data after the last import is the same as after importing that file into a clean profile, with no growth from the intermediate trees

### Requirement: Import Lock Suspends Bookmark-Sync Listeners

The system SHALL hold an import lock across the entire delete-and-recreate span,
enabled before the delete phase begins and disabled only after all creation and
state restoration finishes. While the lock is held, the extension's normal
bookmark-synchronization behavior SHALL be suspended: the background listeners
that auto-place newly created bookmarks, garbage-collect state for removed
bookmarks, and re-place moved bookmarks SHALL NOT act on the delete/create events
the import produces, and the new-tab UI's live-refetch subscribers SHALL be
suspended. On release the system SHALL trigger a single UI resync so views catch
up in one pass. The lock SHALL be acquired only after the parse-and-version gate passes and the
backup prompt is answered, so an import denied or cancelled before that point
never suspends the listeners. The lock SHALL be released even if the import fails
partway, and releasing SHALL be idempotent so a partial acquire cannot leave the
listeners suspended. After the import returns by any path — success, denial, or
error — the listeners SHALL be operating normally.

The lock SHALL be durable against the background service worker being torn down
and restarted mid-import: it SHALL be recorded outside the service worker's
in-memory state, so listeners re-registered on a fresh worker observe a lock that
is still held. The lock record SHALL carry the time it was taken, and a lock
older than a bounded maximum import duration SHALL be treated as stale and
ignored, so an importer that crashed without releasing cannot suspend
synchronization permanently.

#### Scenario: Auto-placement does not run during import
- **WHEN** the import creates bookmarks while the lock is held
- **THEN** the background auto-placement listener does not assign grid positions, and the importer's restored positions are the only positions written

#### Scenario: Removal cleanup does not run during import
- **WHEN** the import deletes existing bookmarks while the lock is held
- **THEN** the per-item removal cleanup does not run for those deletions

#### Scenario: UI refetch is coalesced
- **WHEN** the import completes and releases the lock
- **THEN** the new-tab views refresh once rather than on every intermediate delete/create event

#### Scenario: Lock is released after a failure
- **WHEN** the import fails partway through, after the lock was acquired
- **THEN** the import lock is released so the sync listeners resume normally

#### Scenario: A pre-flight denial never suspends the listeners
- **WHEN** the import is denied at the parse-and-version gate, or the user cancels the backup prompt
- **THEN** the lock is never acquired and the sync listeners keep operating normally

#### Scenario: The lock survives a service-worker restart
- **WHEN** the background service worker is torn down and restarted while an import is still running
- **THEN** the listeners registered by the new worker observe the lock as held and continue to stand down for the rest of the import

#### Scenario: A stale lock does not wedge synchronization
- **WHEN** a lock record is older than the bounded maximum import duration, because the importer terminated without releasing it
- **THEN** the listeners treat it as not held and resume normal synchronization

### Requirement: Restore General Settings and Global Images

The import SHALL restore the general block: the general-settings object, the
sidebar width, and the two global reserved-key images (canvas background and
default folder icon). When the file records an image as absent, the
corresponding global image SHALL be cleared rather than left as-is.

The two global images SHALL be subject to the same content validation the
per-item icon path applies before they are persisted — the canvas background
against the background-image rules and the default folder icon against the icon
rules — so that a corrupted or hand-edited file cannot cause arbitrary bytes of
arbitrary size to be stored. An image that fails to decode or validate SHALL NOT
abort the import; the corresponding global image SHALL be cleared instead,
mirroring the swallow-and-fall-back behavior of the per-item icon path.

#### Scenario: General settings are restored
- **WHEN** an import completes
- **THEN** the canvas background metadata, sidebar width, and any other general settings match the file

#### Scenario: Global images are restored or cleared
- **WHEN** an import completes
- **THEN** the canvas background image and default folder icon match the file, being set when the file includes them and cleared when the file records them as absent

#### Scenario: An invalid global image is rejected rather than stored
- **WHEN** the file's canvas background or default folder icon fails validation (wrong content type, undecodable, or over the size limit)
- **THEN** the offending image is not persisted, the corresponding global image is cleared, and the import completes rather than aborting

### Requirement: Skip-and-Report of Entries That Fail Creation Guards
For a compatible file, the system SHALL recreate every valid entry and SHALL
skip an entry whose title is empty/whitespace-only or whose url fails the
navigation safe-scheme allowlist, rather than aborting the restore. A folder
that cannot be created SHALL take its descendants into the skip count. The system
SHALL attempt to recreate a file root's contents into that protected root and, if
creation into the root fails (for example a Mobile root that is unavailable in
the target profile), SHALL skip that root's subtree and record it in the report
rather than silently dropping it or aborting the import. A custom icon that fails
to decode or validate SHALL NOT cause a skip — the item is created and falls back
to its default icon. When at least one entry is skipped, the system SHALL download
a report file named `<import-file-name-without-extension>-report.json`, listing
each skipped entry with its absolute folder path, name, url, and skip reason.

#### Scenario: A bad entry is skipped, not fatal
- **WHEN** the file contains an entry with an empty title or an unsafe url
- **THEN** that entry is skipped and the rest of the import completes

#### Scenario: A root that cannot be recreated is reported, not silently dropped
- **WHEN** creating the contents of a file root into its protected root fails (e.g. the target profile has no Mobile root)
- **THEN** that root's subtree is recorded in the report and the rest of the import completes, rather than the subtree being silently skipped or the import aborting

#### Scenario: A skipped folder takes its descendants
- **WHEN** a folder cannot be created
- **THEN** the folder and all of its descendant entries are counted as skipped

#### Scenario: A bad icon does not skip its item
- **WHEN** an entry's inline icon fails to decode or validate
- **THEN** the entry is still created and renders with its default icon

#### Scenario: A report file is downloaded when entries are skipped
- **WHEN** an import finishes with one or more skipped entries
- **THEN** a report file named `<import-file-name-without-extension>-report.json` is downloaded, listing each skipped entry's absolute folder path, name, url, and reason

#### Scenario: No report file when nothing is skipped
- **WHEN** an import finishes with zero skipped entries
- **THEN** no report file is downloaded
