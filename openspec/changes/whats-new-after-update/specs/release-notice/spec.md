## ADDED Requirements

### Requirement: A User-Facing Changelog Is the Source of the Notes

The repository SHALL maintain a user-facing changelog, distinct from the
contributor-facing release body, holding one entry per released version written
for users: a short list of what changed, with bug fixes rolled up into a single
sentence rather than enumerated.

An entry SHALL be able to declare a **heads-up** — one sentence, written for
users, describing a change they will notice and reassuring them about it. The
heads-up SHALL NOT be copied from a commit message footer, which addresses
contributors.

The changelog SHALL be the single source of the shipped notes. No hand-maintained
copy of the notes SHALL exist in the extension's sources.

#### Scenario: An entry exists for the released version
- **WHEN** the changelog is read for the version the extension reports
- **THEN** an entry for that version is present, written for users, with bug fixes summarized rather than enumerated

#### Scenario: An entry can declare a heads-up
- **WHEN** a release changes something users will notice
- **THEN** its changelog entry carries a single user-facing heads-up sentence

#### Scenario: The notes are not duplicated in the sources
- **WHEN** the extension's sources are inspected for release-note text
- **THEN** no copy of the notes is stored among them; the shipped notes are derived from the changelog at build time

### Requirement: The Current Version's Notes Ship Inside the Bundle

The build SHALL bake the changelog entry matching the extension's version into
the shipped bundle. The extension SHALL read its notes only from that baked
content and SHALL NOT make any network request to obtain them, so that the
extension's no-off-device-transmission posture is preserved.

The build SHALL fail when the entry for the version being built is missing or
cannot be parsed, rather than producing a bundle whose notice window would open
empty.

The bundle SHALL carry the current version's entry.

#### Scenario: The entry is baked into the build
- **WHEN** the extension is built
- **THEN** the changelog entry matching its version is present in the build output

#### Scenario: Notes are never fetched
- **WHEN** the extension displays its release notes
- **THEN** no network request is made to obtain them

#### Scenario: A missing entry fails the build
- **WHEN** the extension is built at a version with no parseable changelog entry
- **THEN** the build fails

### Requirement: An Update Is Detected in the Extension's Background Context

The extension SHALL detect its own update in the background context, which runs
whether or not any new-tab page is open, and SHALL record that a notice is
pending for the new version.

A **fresh install** SHALL record the installed version as already seen and SHALL
NOT leave a notice pending, so a first-time user is not shown a changelog for
software they have never run.

The distinction between an update and a fresh install SHALL be made from the
install event's own reason, and SHALL NOT be inferred from the absence of stored
state — every user updating from a version released before this feature existed
has no stored state and is nonetheless an update.

#### Scenario: An update leaves a notice pending
- **WHEN** the extension is updated to a new version
- **THEN** a pending notice for that version is recorded, together with the version updated from

#### Scenario: A fresh install shows nothing
- **WHEN** the extension is installed for the first time
- **THEN** the installed version is recorded as seen and no notice is pending

#### Scenario: An update from a version predating this feature is still an update
- **WHEN** the extension updates from a version that stored no seen version
- **THEN** a pending notice is recorded, rather than the user being treated as a fresh install

### Requirement: The Notice Window Opens Once After an Update

When a notice is pending, the new-tab page SHALL open the release-notice window
automatically, after the page has finished restoring its folder and layout — not
during loading.

The window SHALL NOT open when no notice is pending.

#### Scenario: The window opens on the first unhurried new tab after an update
- **WHEN** a new-tab page loads with a notice pending and completes its restoration
- **THEN** the release-notice window opens

#### Scenario: The window does not open over a loading page
- **WHEN** a new-tab page is still restoring
- **THEN** the release-notice window has not yet opened

#### Scenario: No notice, no window
- **WHEN** a new-tab page loads with no notice pending
- **THEN** no release-notice window opens

### Requirement: The Notice Window's Content

The release-notice window SHALL be a centered modal window matching the Edit
Bookmark, Folder Settings, and General Settings windows' style — a titlebar with
a title and a close (✕) control, an opaque body, portaled over the viewport.

Its body SHALL show, for the version it describes: the heads-up block when the
entry declares one, the version's user-facing changes, and the extension's
running version.

The window SHALL render the notes as ordinary elements built from structured
content, and SHALL NOT render them by assigning unsanitized markup, consistent
with the project's prohibition on raw HTML injection.

Only one release-notice window SHALL be open at a time.

#### Scenario: The window matches the other windows' style
- **WHEN** the release-notice window opens
- **THEN** it is a centered modal window with a titlebar, a title, a close control, and an opaque body, portaled over the viewport

#### Scenario: The window shows the version's changes
- **WHEN** the release-notice window is open
- **THEN** it shows the user-facing changes for its version

#### Scenario: The running version is shown
- **WHEN** the release-notice window is open
- **THEN** the extension's running version is displayed

#### Scenario: Notes are not injected as markup
- **WHEN** the notes are rendered
- **THEN** they are built as elements from structured content rather than assigned as unsanitized markup

### Requirement: Each Entrance Leads With What Was Asked For

The window SHALL lead with the content its entrance was opened for.

Opened from the settings window, it SHALL begin with a brief introduction to the
extension — what it does, and that the data it handles stays on the device —
then separate that introduction from the release notes with a visible divider
and a heading naming the notes section.

Opened automatically after an update, it SHALL begin with the release notes and
SHALL NOT render the introduction or the section heading, so that nothing stands
between the user and the news the window exists to deliver.

The release notes themselves SHALL be identical from either entrance.

#### Scenario: The About entrance introduces the extension first
- **WHEN** the window is opened from the settings window
- **THEN** it shows an introduction to the extension, then a divider, then a heading naming the release-notes section, then the notes

#### Scenario: The update entrance leads with the news
- **WHEN** the window opens automatically after an update
- **THEN** it shows the release notes without an introduction or a section heading above them

#### Scenario: The notes do not vary by entrance
- **WHEN** the notes shown from one entrance are compared with those shown from the other
- **THEN** they are the same

### Requirement: The Heads-Up Block Appears Only When Declared

The release-notice window SHALL render a distinct heads-up block, ahead of the
list of changes, when and only when the version's changelog entry declares one.

#### Scenario: A declared heads-up is shown first
- **WHEN** the window opens for a version whose entry declares a heads-up
- **THEN** the heads-up is shown as a distinct block ahead of the list of changes

#### Scenario: No heads-up, no block
- **WHEN** the window opens for a version whose entry declares no heads-up
- **THEN** no heads-up block is rendered

### Requirement: Dismissing the Window Marks the Version Seen

Closing the release-notice window by any means — the close control, the Escape
key, or the backdrop — SHALL mark its version as seen and clear the pending
notice, so the window does not open automatically again for that version.

Leaving the page without dismissing the window SHALL NOT mark the version seen.

The seen state SHALL be shared across the extension's open pages, so dismissing
the window in one new-tab page SHALL close it in every other open new-tab page.

#### Scenario: The close control marks it seen
- **WHEN** the user closes the window with the close control
- **THEN** the version is marked seen and the window does not open automatically again for that version

#### Scenario: Escape marks it seen
- **WHEN** the user presses the Escape key with the window open
- **THEN** the window closes and the version is marked seen

#### Scenario: The backdrop marks it seen
- **WHEN** the user clicks the backdrop outside the window
- **THEN** the window closes and the version is marked seen

#### Scenario: Navigating away does not mark it seen
- **WHEN** the user leaves the page without dismissing the window
- **THEN** the version is not marked seen, and the window opens again on a later new-tab page

#### Scenario: Dismissal settles every open tab
- **WHEN** several new-tab pages are open showing the window and the user dismisses it in one of them
- **THEN** the window closes in the others as well

### Requirement: Notice State Is Not Part of the User's Exported State

The pending-notice and seen-version state SHALL be excluded from the extension's
state export and import, consistent with other state describing the installation
rather than the user's configuration.

#### Scenario: Export omits the notice state
- **WHEN** the user exports their state
- **THEN** the exported file contains no pending-notice or seen-version state

#### Scenario: Import leaves the notice state untouched
- **WHEN** the user imports a state file
- **THEN** their pending-notice and seen-version state is unchanged by the import
