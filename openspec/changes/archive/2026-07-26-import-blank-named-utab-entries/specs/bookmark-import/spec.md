## ADDED Requirements

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

## MODIFIED Requirements

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
