## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Skip-and-Report of Invalid Entries
For a file that is a valid uTab export, the system SHALL import every valid
entry and SHALL skip individual entries that cannot be imported — a folder with
an empty or whitespace-only name, or a bookmark with an empty or whitespace-only
title or an unsafe url — rather than aborting the whole import. Empty slots, as
defined by the uTab Empty Slots Are Not Import Entries requirement, are not
entries and SHALL NOT be skipped, counted, or reported; the skipped count SHALL
mean the number of entries that looked like real folders or bookmarks and could
not be imported. When the import finishes, the system SHALL report a summary of
how many folders and bookmarks were created and how many entries were skipped.
When the import produced at least one skipped entry, warning, or fatal error,
the system SHALL additionally download a report file detailing each one, and the
summary SHALL name that file so the user knows where to find it.

#### Scenario: One bad entry does not abort the import
- **WHEN** an export contains a mix of valid entries and entries with a blank title or unsafe url
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
