## ADDED Requirements

### Requirement: Root Folder Import Confirms Its Target
An import started from a root folder's row SHALL confirm the target folder by
name before any file is chosen and before anything is created, and SHALL create
nothing if the user cancels.

This applies only to the root-row entry point. The import control inside a
folder's settings window SHALL NOT gain a confirmation step: its target is
evident from the window it is in, whereas a row button carries no such context.
The confirmation exists because importing into a root creates a subfolder per
exported folder directly inside it, and for the Bookmarks Bar that changes
Chrome's own visible toolbar — an effect reaching outside the extension.

#### Scenario: The target root is named before a file is chosen
- **WHEN** the user activates the import button on a root folder's row
- **THEN** a confirmation is shown naming that root folder as the destination, before any file picker is opened

#### Scenario: Cancelling creates nothing
- **WHEN** the user cancels the confirmation
- **THEN** no file picker is opened, no folder or bookmark is created, and no report file is produced

#### Scenario: The in-settings import path is unchanged
- **WHEN** the user imports from the control inside a folder's settings window
- **THEN** no target confirmation is shown and the flow behaves exactly as before

### Requirement: Import Reports Live Progress
While an import runs the system SHALL display a progress indication that
includes an animated activity indicator and a determinate count of entries
processed against the total that will be attempted.

The total SHALL count only entries the import will actually attempt — each
exported folder, and each of its bookmarks that is not an empty uTab grid slot
as defined by the uTab Empty Slots Are Not Import Entries requirement. Empty
slots SHALL NOT be counted. They are skipped at negligible cost and typically
form the large majority of an export's raw entries, so counting them would make
the readout advance almost instantly to a high percentage and then appear
stalled for the remainder of the import — misreporting exactly the phase the
user is waiting through.

The animated indicator SHALL respect a reduced-motion preference: when the user
has requested reduced motion the system SHALL convey the same in-progress state
without animation.

#### Scenario: Progress advances against the attempted total
- **WHEN** an import of a uTab export is running
- **THEN** a count of processed entries and the total to be attempted are displayed, and the count advances as entries are processed

#### Scenario: Empty grid slots are excluded from the total
- **WHEN** an export's folders contain empty uTab grid slots alongside real bookmarks
- **THEN** the displayed total counts the folders and the real bookmarks only, and never exceeds or falls short of the number of entries actually attempted

#### Scenario: An animated indicator shows work is in progress
- **WHEN** an import is running
- **THEN** an animated activity indicator is displayed alongside the count

#### Scenario: Reduced motion suppresses the animation
- **WHEN** an import is running and the user has requested reduced motion
- **THEN** the in-progress state is still conveyed, and the indicator does not animate

### Requirement: Import Result Persists Until Acknowledged
The system SHALL display the outcome of an import — the counts and, when a
report file was produced, its filename — and SHALL keep that message visible
until the user acknowledges it rather than dismissing it on a timer.

The message names a file the user must be able to find. A timed dismissal would
remove the filename while the user is still reading it, defeating the report.

#### Scenario: The result names the report file and waits
- **WHEN** an import completes and a report file was downloaded
- **THEN** the outcome message states the counts and the report's filename, and remains visible until the user acknowledges it

#### Scenario: The result survives selecting another folder
- **WHEN** an import is running or its outcome is displayed, and the user selects a different folder in the sidebar
- **THEN** the progress or outcome message remains visible

### Requirement: Import Guards Against Navigating Away
While an import is in flight the system SHALL warn the user before the page
unloads, and SHALL remove that warning once the import settles.

An import started from a root row leaves the canvas interactive, and clicking a
bookmark navigates the current tab. Unloading mid-import abandons the run with
folders and bookmarks already created and no report file written, because the
report is emitted only when the importer finishes or fails.

The warning reduces accidental loss; it cannot prevent a deliberate departure.
A partial import therefore remains possible, and re-running the same file
afterwards creates duplicates rather than resuming, per the Import Always
Creates New Items requirement.

#### Scenario: Leaving mid-import is warned about
- **WHEN** an import is in flight and the page is about to unload — the user activates a bookmark, closes the tab, or reloads
- **THEN** the browser's leave-page confirmation is shown

#### Scenario: The guard is released when the import settles
- **WHEN** an import completes or fails
- **THEN** navigating away no longer triggers a leave-page confirmation

### Requirement: One Import At A Time
The system SHALL allow only one import to be in flight at a time, and SHALL
disable every import entry point while one is running.

#### Scenario: Import entry points are disabled during an import
- **WHEN** an import started from one root folder's row is in flight
- **THEN** the import button on every root folder's row is disabled, and a second import cannot be started until the first settles
