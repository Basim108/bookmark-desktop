## ADDED Requirements

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
entry and SHALL skip individual entries that cannot be imported — a folder with
an empty or whitespace-only name, or a bookmark with an empty or whitespace-only
title or an unsafe url — rather than aborting the whole import. When the import
finishes, the system SHALL report a summary of how many folders and bookmarks
were created and how many entries were skipped.

#### Scenario: One bad entry does not abort the import
- **WHEN** an export contains a mix of valid entries and entries with a blank title or unsafe url
- **THEN** all valid entries are imported and only the invalid entries are skipped

#### Scenario: Import reports a summary
- **WHEN** an import finishes
- **THEN** the user is shown a summary of the number of folders created, bookmarks created, and entries skipped

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
