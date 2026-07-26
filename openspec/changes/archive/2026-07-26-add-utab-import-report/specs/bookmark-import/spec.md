## MODIFIED Requirements

### Requirement: Skip-and-Report of Invalid Entries
For a file that is a valid uTab export, the system SHALL import every valid
entry and SHALL skip individual entries that cannot be imported — a folder with
an empty or whitespace-only name, or a bookmark with an empty or whitespace-only
title or an unsafe url — rather than aborting the whole import. When the import
finishes, the system SHALL report a summary of how many folders and bookmarks
were created and how many entries were skipped. When the import produced at
least one skipped entry, warning, or fatal error, the system SHALL additionally
download a report file detailing each one, and the summary SHALL name that file
so the user knows where to find it.

#### Scenario: One bad entry does not abort the import
- **WHEN** an export contains a mix of valid entries and entries with a blank title or unsafe url
- **THEN** all valid entries are imported and only the invalid entries are skipped

#### Scenario: Import reports a summary
- **WHEN** an import finishes
- **THEN** the user is shown a summary of the number of folders created, bookmarks created, and entries skipped

#### Scenario: Summary names the report file
- **WHEN** an import finishes having recorded at least one skipped entry, warning, or fatal error
- **THEN** the summary names the downloaded report file in addition to the counts

## ADDED Requirements

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

#### Scenario: A folder skipped for a blank name takes its bookmarks into the report
- **WHEN** a folder cannot be created because its name is blank
- **THEN** the folder and each bookmark it would have held each get a `skipped` row, the bookmarks' rows carrying the reason `parent-skipped`

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
