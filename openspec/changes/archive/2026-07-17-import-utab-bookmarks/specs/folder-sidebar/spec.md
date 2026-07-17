## ADDED Requirements

### Requirement: Import Bookmarks Control in Folder Settings
The Folder Settings window SHALL provide an "Import Bookmarks" dropdown control
whose items each start an import into the folder that window is open on. The
dropdown SHALL contain a single item, "Import uTab", which SHALL open the
operating system's file picker restricted to JSON files so the user can choose a
uTab export from their local machine. The chosen file SHALL be read locally and
SHALL NOT be transmitted off-device. After the import runs, the window SHALL
show its result (a success summary or an error) to the user.

#### Scenario: Import Bookmarks dropdown is available in Folder Settings
- **WHEN** the Folder Settings window is open for a folder
- **THEN** it displays an "Import Bookmarks" dropdown containing an "Import uTab" item

#### Scenario: Import uTab opens a local file picker
- **WHEN** the user selects "Import uTab" from the dropdown
- **THEN** the operating system's file picker opens for choosing a JSON file from the local machine

#### Scenario: Import targets the current folder
- **WHEN** the user completes an import from a folder's settings window
- **THEN** the imported folders and bookmarks are created inside that folder

#### Scenario: Import result is shown in the window
- **WHEN** an import started from the Folder Settings window finishes
- **THEN** the window shows the import's result — a summary of what was imported and skipped, or an error if the file was rejected
