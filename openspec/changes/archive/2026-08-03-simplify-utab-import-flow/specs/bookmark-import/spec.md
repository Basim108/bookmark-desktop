## REMOVED Requirements

### Requirement: Root Folder Import Confirms Its Target
**Reason**: Built, used, and rejected on contact. In practice the confirmation
read as a speed bump rather than a safeguard: its entire content was the
destination's name and two buttons. Its original justification — that a row
button carries no context about where the import lands — has also weakened,
because the row controls have since grown to a 24x24 target with a per-control
hover highlight, making the mis-click it guarded against materially less likely.

**Migration**: Activating a root row's import button now opens the file picker
directly. The picker is itself a modal, cancellable step that creates nothing,
so a mis-click costs a dismissed dialog rather than data. The one piece of
information the confirmation genuinely supplied — the destination — is preserved
by the Import Reports Live Progress requirement, which now names it while the
import runs.

## ADDED Requirements

### Requirement: A Window Running An Import Cannot Be Dismissed
A window that has started an import SHALL remain open for the whole of it and
SHALL NOT be dismissable while it runs — not by its close control, not by
clicking its backdrop, and not by pressing Escape. It SHALL report the import's
progress and outcome in place, and SHALL remain open after the import finishes,
showing the outcome and the report file's name until the user closes it
themselves.

This is what keeps an in-flight import from being orphaned. Previously such a
window could be closed mid-import, leaving the import running with its report
still downloading and its summary set on an unmounted component: a file
appearing in the user's Downloads with no explanation and no summary anywhere.

Blocking all three dismissal routes is required, not just the keyboard one. A
window that guards Escape alone still has two ways to reproduce the same
orphaning.

The window SHALL become dismissable again once the import settles, whether it
succeeded or failed, so a finished import never traps the user in a window they
cannot close.

#### Scenario: The window stays open and reports progress in place
- **WHEN** an import started from a settings window is running
- **THEN** that window remains open and displays the import's progress within itself

#### Scenario: The window cannot be dismissed mid-import
- **WHEN** an import is running and the user presses Escape, clicks the window's close control, or clicks its backdrop
- **THEN** the window is not dismissed and the import continues undisturbed

#### Scenario: The outcome stays in the window after the import ends
- **WHEN** an import started from a settings window finishes
- **THEN** that window remains open, showing the outcome and, when a report file was produced, its filename

#### Scenario: The window can be closed again once the import settles
- **WHEN** an import has completed or failed
- **THEN** the window's close control, backdrop, and Escape dismiss it as they normally would

## MODIFIED Requirements

### Requirement: Import Reports Live Progress
While an import runs the system SHALL display a progress indication that
includes an animated activity indicator and a determinate count of entries
processed against the total that will be attempted. Every uTab import entry
point SHALL report this same information, so an import started from a folder's
settings window is as legible as one started from a root folder's row.

Where the import is reported SHALL follow from where it was started: a window
that started an import reports within itself, and an import with no window to
report into — one started from a folder row — reports in a transient surface
that names the destination folder. Naming the destination is what allows that
entry point to omit a confirmation step: the user learns where the import is
landing at the moment it matters, without a dialog to dismiss. A window-started
import needs no such naming, because the window it is reported in already
identifies the folder.

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

#### Scenario: An import with no window names its destination
- **WHEN** an import started from a folder row is running
- **THEN** its progress indication names the folder the import is creating items inside

#### Scenario: Both entry points report the same information
- **WHEN** an import is started from a folder's settings window, and separately when one is started from a root folder's row
- **THEN** both display an activity indicator and a determinate count of entries processed against the total

### Requirement: Import Result Persists Until Acknowledged
The system SHALL display the outcome of an import — the counts and, when a
report file was produced, its filename — and SHALL keep that message visible
until the user acknowledges it rather than dismissing it on a timer. This SHALL
hold for every uTab import entry point.

The message names a file the user must be able to find. A timed dismissal would
remove the filename while the user is still reading it, defeating the report.

#### Scenario: The result names the report file and waits
- **WHEN** an import completes and a report file was downloaded
- **THEN** the outcome message states the counts and the report's filename, and remains visible until the user acknowledges it

#### Scenario: The result survives selecting another folder
- **WHEN** an import is running or its outcome is displayed, and the user selects a different folder in the sidebar
- **THEN** the progress or outcome message remains visible

#### Scenario: The result of a settings-window import is shown in that window
- **WHEN** an import started from a folder's settings window completes
- **THEN** its outcome is displayed in that still-open window and is not removed on a timer

### Requirement: Import Guards Against Navigating Away
While an import is in flight the system SHALL warn the user before the page
unloads, and SHALL remove that warning once the import settles. This SHALL apply
to every uTab import entry point.

An import leaves the canvas interactive, and clicking a bookmark navigates the
current tab. Unloading mid-import abandons the run with folders and bookmarks
already created and no report file written, because the report is emitted only
when the importer finishes or fails.

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

#### Scenario: The guard covers imports started from a settings window
- **WHEN** an import started from a folder's settings window is in flight and the page is about to unload
- **THEN** the browser's leave-page confirmation is shown, as it is for an import started from a root folder's row
