# bookmark-import Specification

## Purpose
TBD - created by archiving change import-utab-bookmarks. Update Purpose after archive.
## Requirements
### Requirement: Import uTab Export Into a Selected Folder
The system SHALL provide a way to import a uTab JSON export into a
user-selected folder, creating real Chrome bookmark folders and bookmarks. The
uTab export SHALL be interpreted as a JSON object containing a `folders` array,
where each folder has a `name` string, an optional `preview` (a base64 image
data URL for the folder's icon), and a `bookmarks` array; and each bookmark has
a `title` string, a `url` string, and an optional `preview` (a base64 image
data URL for the bookmark's icon). For each folder in the export the system
SHALL create a Chrome subfolder inside the selected folder, and for each of that
folder's bookmarks the system SHALL create a Chrome bookmark inside that
subfolder. Imported items SHALL be created via `chrome.bookmarks` so they become
part of Chrome's own bookmark store.

#### Scenario: Folders become subfolders of the selected folder
- **WHEN** a uTab export with one or more folders is imported into a selected folder
- **THEN** each export folder is created as a Chrome subfolder inside the selected folder, carrying its `name` as the folder title

#### Scenario: Bookmarks are created inside their folder
- **WHEN** an export folder containing bookmarks is imported
- **THEN** each of its bookmarks is created as a Chrome bookmark inside the corresponding new subfolder, carrying its `title` and `url`

#### Scenario: Imported bookmarks are positioned automatically
- **WHEN** bookmarks are created by an import
- **THEN** they receive grid positions through the same automatic next-free-cell placement as any other newly created bookmark, in the order the export listed them, and the importer does not write positions itself

### Requirement: Import Icon Handling
The system SHALL decode each `preview` base64 image data URL and, if it passes
the same icon validation used for user uploads (format sniffing for
png/jpeg/webp/avif, a successful decode, and the icon size limit), store it as
the created folder's or bookmark's custom icon and mark that item as having a
custom icon. A `preview` that is absent, not a decodable image, an unsupported
format, or over the icon size limit SHALL be skipped without preventing its
folder or bookmark from being imported; such an item SHALL fall back to the
default folder icon or the URL's favicon.

#### Scenario: Valid preview becomes the item's custom icon
- **WHEN** a folder or bookmark in the export has a `preview` that decodes and passes icon validation
- **THEN** the decoded image is stored as that item's custom icon and the item is marked as having a custom icon

#### Scenario: Invalid or missing preview falls back without dropping the item
- **WHEN** a folder or bookmark has no `preview`, or a `preview` that fails to decode or fails validation
- **THEN** the folder or bookmark is still imported and renders with the default folder icon or the URL's favicon

### Requirement: Import URL Safety
The system SHALL validate every bookmark `url` against the same navigation
safe-scheme allowlist used for click-navigation and bookmark editing before
creating the bookmark, and SHALL NOT create a bookmark whose url fails that
check.

#### Scenario: Unsafe URL is not imported
- **WHEN** a bookmark in the export has a url whose scheme is not on the navigation safe-allowlist (for example `javascript:` or `data:`)
- **THEN** that bookmark is not created and is counted as skipped

#### Scenario: Safe URL is imported
- **WHEN** a bookmark in the export has a url with an allowed scheme
- **THEN** the bookmark is created with that url

### Requirement: Skip-and-Report of Invalid Entries
For a file that is a valid uTab export, the system SHALL import every valid
entry and SHALL skip individual entries that cannot be imported — a bookmark
whose url fails the navigation safe-scheme check — rather than aborting the
whole import. A blank folder name or a blank bookmark title SHALL NOT be a
reason to skip an entry; both are handled by their fallback requirements. Empty
slots, as defined by the uTab Empty Slots Are Not Import Entries requirement,
are not entries and SHALL NOT be skipped, counted, or reported. The skipped
count SHALL mean the number of entries that looked like real folders or
bookmarks and could not be imported. When the import finishes, the system SHALL
report a summary of how many folders and bookmarks were created and how many
entries were skipped. When the import produced at least one skipped entry,
warning, or fatal error, the system SHALL additionally download a report file
detailing each one, and the summary SHALL name that file so the user knows
where to find it.

#### Scenario: One bad entry does not abort the import
- **WHEN** an export contains a mix of valid entries and entries with an unsafe url
- **THEN** all valid entries are imported and only the invalid entries are skipped

#### Scenario: Import reports a summary
- **WHEN** an import finishes
- **THEN** the user is shown a summary of the number of folders created, bookmarks created, and entries skipped

#### Scenario: Summary names the report file
- **WHEN** an import finishes having recorded at least one skipped entry, warning, or fatal error
- **THEN** the summary names the downloaded report file in addition to the counts

#### Scenario: The skipped count excludes empty slots
- **WHEN** an export folder's `bookmarks` array holds both empty slots and entries that fail to import
- **THEN** the reported skipped count counts only the failing entries

#### Scenario: A blank name is no longer a skip
- **WHEN** an export contains a folder with a blank name and a bookmark with a blank title but a safe url
- **THEN** both are imported under their fallback names and the reported skipped count does not include them

### Requirement: uTab Import Report File
When a uTab import records at least one skipped entry, warning, or fatal error,
the system SHALL download a report file named
`<import-file-name-without-extension>-report.log`, produced and saved entirely
in-page so that no additional browser permission is required and no data leaves
the device. The file SHALL be CSV-formatted with a single header line followed
by one row per recorded entry, using the columns `status`, `id`, `folder`,
`bookmark-title`, `bookmark-url`, `skipping-reason`, `error`, where `id` is the
source entry's uTab `_id`. `status` SHALL be one of `skipped`, `warning`, or
`fatal`, and the skipped count shown in the summary SHALL count only `skipped`
rows. The report SHALL NOT list successfully imported entries. When an import
records no skipped entries, warnings, or errors, the system SHALL NOT download
a report file.

#### Scenario: Report is downloaded when entries are skipped
- **WHEN** an import finishes with one or more skipped entries
- **THEN** a report file named `<import-file-name-without-extension>-report.log` is downloaded containing a header line and one row per skipped entry

#### Scenario: No report file for a clean import
- **WHEN** an import finishes with no skipped entries, warnings, or errors
- **THEN** no report file is downloaded

#### Scenario: Successfully imported entries are absent from the report
- **WHEN** an import creates a bookmark without incident
- **THEN** that bookmark has no row in the report file

#### Scenario: A skipped entry records its uTab id
- **WHEN** an entry that carries a uTab `_id` is skipped
- **THEN** its report row's `id` column holds that `_id`

#### Scenario: No report file when the whole file is rejected
- **WHEN** the chosen file is not valid JSON, or is JSON without a `folders` array
- **THEN** the import fails with an inline error and no report file is downloaded

### Requirement: Import Report Records Non-Fatal Icon Failures
A `preview` that is absent, fails to decode, or fails icon validation SHALL NOT
skip its folder or bookmark, and the system SHALL record the failure as a
`warning` row in the report rather than discarding it silently. The item SHALL
still be created and SHALL fall back to its default icon.

#### Scenario: An unusable preview is imported as a warning
- **WHEN** a bookmark's `preview` fails to decode or fails icon validation
- **THEN** the bookmark is still created with its default icon, and a `warning` row recording the failure appears in the report

#### Scenario: An icon warning is not counted as a skip
- **WHEN** an import records only icon warnings and no skipped entries
- **THEN** the summary reports zero skipped entries and the report file is still downloaded

### Requirement: Import Report Is Injection-Safe
Because every title and url in the report originates in an untrusted file and
is rendered for a human in a spreadsheet, the system SHALL escape each field
before writing it. A field whose value begins with `=`, `+`, `-`, `@`, a tab, or
a carriage return SHALL be prefixed so that a spreadsheet application does not
interpret it as a formula, and any field containing a comma, double quote, or
newline SHALL be quoted and its embedded quotes doubled so the file remains
parseable as CSV.

#### Scenario: A formula-shaped title cannot execute
- **WHEN** a skipped entry's title begins with `=`, `+`, `-`, `@`, a tab, or a carriage return
- **THEN** its report field is prefixed so a spreadsheet treats it as text rather than a formula

#### Scenario: Separators inside a field do not break the row
- **WHEN** a skipped entry's title or url contains a comma, a double quote, or a newline
- **THEN** the field is quoted with embedded quotes doubled, and the report still parses as one row per entry

### Requirement: Import Error Handling
An error thrown while creating a bookmark or folder, or while storing an icon,
SHALL NOT leave the import in progress indefinitely. The system SHALL catch it,
record it as a `fatal` row in the report, end the import, and show the user the
summary of what was created before the failure. The report SHALL be written
from whatever rows were accumulated up to the point of failure, so that a
partially completed import still produces a log.

#### Scenario: A creation failure ends the import cleanly
- **WHEN** creating a bookmark or folder throws (for example a storage quota error)
- **THEN** the import stops, the in-progress indicator is cleared, and the user is shown a summary rather than an indefinitely pending state

#### Scenario: A partially completed import still writes its report
- **WHEN** an import fails partway through after already skipping some entries
- **THEN** the downloaded report contains the rows accumulated before the failure plus a `fatal` row describing the error

#### Scenario: The fatal row carries the error detail
- **WHEN** an import ends because of a thrown error
- **THEN** a row with status `fatal` records the error information in its `error` column

### Requirement: Whole-File Rejection of Non-uTab Input
The system SHALL reject a chosen file that is not valid JSON, or that is valid
JSON but does not match the uTab export shape (missing a `folders` array, or a
`folders` value that is not an array), and SHALL create nothing for such a file
while showing an error.

#### Scenario: Non-JSON file is rejected
- **WHEN** the user chooses a file whose contents are not valid JSON
- **THEN** the import fails with an error and no folders or bookmarks are created

#### Scenario: JSON without a folders array is rejected
- **WHEN** the user chooses a valid-JSON file that has no `folders` array
- **THEN** the import fails with an error and no folders or bookmarks are created

### Requirement: Import Always Creates New Items
The system SHALL create new folders and bookmarks on every import without
de-duplicating against items that already exist. Re-importing the same export
SHALL produce additional folders and bookmarks rather than merging into or
skipping existing ones.

#### Scenario: Re-importing the same file duplicates
- **WHEN** the same uTab export is imported twice into the same folder
- **THEN** two sets of the export's folders and bookmarks exist, and no existing item is modified or skipped as a duplicate

### Requirement: uTab Empty Slots Are Not Import Entries
A uTab export lists each folder's bookmarks as a fixed-size array in which
unused grid positions appear as placeholder elements. An element of a folder's
`bookmarks` array whose `url` is absent, is not a string, or is empty or
whitespace-only SHALL be treated as an empty slot rather than as a bookmark
that failed to import: the system SHALL NOT create anything for it, SHALL NOT
include it in the skipped count reported in the summary, and SHALL NOT write a
row for it in the import report. This SHALL apply both to bookmarks in a folder
that was created and to bookmarks orphaned by a folder that could not be
created.

The absence of a url SHALL be sufficient on its own to identify an empty slot;
the entry's `title` and `_id` SHALL NOT be consulted.

#### Scenario: An entry with no url is ignored entirely
- **WHEN** an export folder's `bookmarks` array contains an element with no `url`, or a `url` that is empty or whitespace-only
- **THEN** no bookmark is created for it, it is not counted as skipped in the summary, and it has no row in the import report

#### Scenario: Empty slots do not trigger a report file
- **WHEN** an import's only entries that fail to become bookmarks are empty slots
- **THEN** the summary reports zero skipped entries and no report file is downloaded

#### Scenario: Empty slots under a skipped folder are ignored too
- **WHEN** a folder cannot be created because its name is blank, and its `bookmarks` array contains empty slots
- **THEN** those empty slots produce no `parent-skipped` rows and are not counted as skipped, while its entries that do have a url are still reported as `parent-skipped`

#### Scenario: An entry with a url but no title is not an empty slot
- **WHEN** an export entry has a url but an empty or whitespace-only `title`
- **THEN** it is not treated as an empty slot, and it is handled by the ordinary skip-and-report path

#### Scenario: An unsafe url is not an empty slot
- **WHEN** an export entry has a url that is present but fails the navigation safe-scheme check
- **THEN** it is not treated as an empty slot, it is counted as skipped, and it is reported with the reason `unsafe-url`

### Requirement: Blank uTab Folder Name Falls Back to a Default
A uTab export folder whose `name` is absent, is not a string, or is empty or
whitespace-only SHALL be imported under the default name `"New Folder"` rather
than being skipped. Its bookmarks SHALL be imported into it as they would be
for any named folder. Such a folder SHALL NOT be counted as skipped and SHALL
NOT produce a row in the import report. The substitution SHALL happen in the
importer; the creation guard that rejects a blank folder name SHALL remain in
force for folders created through the user interface, so that an empty name
typed into the New Folder window is still rejected rather than silently
defaulted.

#### Scenario: A folder with a blank name is imported as "New Folder"
- **WHEN** an export folder has an empty or whitespace-only `name`
- **THEN** a folder named `"New Folder"` is created, and it is not counted as skipped and has no report row

#### Scenario: A blank-named folder keeps its bookmarks
- **WHEN** an export folder with a blank `name` contains valid bookmarks
- **THEN** those bookmarks are imported into the `"New Folder"` folder rather than being dropped with their parent

#### Scenario: Several blank-named folders each get the default name
- **WHEN** an export contains more than one folder with a blank `name`
- **THEN** each is created as `"New Folder"`, and the duplicate names are permitted

#### Scenario: The manual New Folder window still rejects a blank name
- **WHEN** the user submits the New Folder window with an empty or whitespace-only name
- **THEN** the folder is not created and the name is not defaulted to `"New Folder"`

### Requirement: Blank uTab Bookmark Title Falls Back to Its URL
A uTab export bookmark that has a usable url but whose `title` is absent, is
not a string, or is empty or whitespace-only SHALL be imported using its full
url as its title, rather than being skipped. The system SHALL set that
bookmark's label display to tooltip-only, so the substituted url is shown on
hover and is never rendered as a label under the icon on the canvas. The title
SHALL be the complete url, not a hostname or other shortened form, because two
entries may differ only in their path. Such a bookmark SHALL NOT be counted as
skipped and SHALL NOT produce a row in the import report. The substitution
SHALL happen in the importer; the creation guard that rejects a blank bookmark
title SHALL remain in force for bookmarks created or edited through the user
interface.

#### Scenario: A blank-titled bookmark is imported under its url
- **WHEN** an export bookmark has a safe url and an empty or whitespace-only `title`
- **THEN** the bookmark is created with its full url as its title, and it is not counted as skipped and has no report row

#### Scenario: The substituted url is not shown under the icon
- **WHEN** a bookmark is imported with its url substituted for a blank title
- **THEN** its label display is tooltip-only, so the url appears on hover rather than as text beneath the icon on the canvas

#### Scenario: Entries differing only by path stay distinguishable
- **WHEN** two blank-titled bookmarks share a host but differ in their path
- **THEN** each carries its full url as its title, so the two are distinguishable

#### Scenario: The fallback does not bypass url safety
- **WHEN** an export bookmark has a blank `title` and a url that fails the navigation safe-scheme check
- **THEN** the bookmark is still not created, is counted as skipped, and is reported with the reason `unsafe-url`

#### Scenario: A bookmark with a title is unaffected
- **WHEN** an export bookmark has a non-blank `title`
- **THEN** it is imported with that title and its label display is left at the default

#### Scenario: The manual bookmark forms still reject a blank title
- **WHEN** the user submits the add or edit bookmark window with an empty or whitespace-only title
- **THEN** the bookmark is not created or updated, and the title is not defaulted to its url

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
