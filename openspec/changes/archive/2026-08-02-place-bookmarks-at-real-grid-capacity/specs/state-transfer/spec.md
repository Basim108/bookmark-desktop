## MODIFIED Requirements

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

The exported file SHALL NOT contain the last opened folder. That value is
session state describing where one machine's user was last working, not a
setting the user configured, so exporting it would carry a stale cursor position
into any profile the file is imported on. Accordingly, importing a file SHALL
leave the importing profile's recorded last opened folder untouched.

The exported file SHALL NOT contain the measured grid capacity either, for the
same class of reason: it is state derived from one machine's window and display
geometry, not a setting the user configured. Carrying it into another profile
would make that profile place bookmarks against a capacity its own canvas does
not have — the exact defect persisting the measurement exists to prevent.
Accordingly, importing a file SHALL leave the importing profile's recorded
measured capacity untouched.

#### Scenario: Export produces a single self-contained file
- **WHEN** the user exports the extension state
- **THEN** one JSON file is downloaded locally containing the bookmark tree, per-folder and per-bookmark settings, grid positions, all custom icons and global images inlined as base64, and the general settings — with no reference to any external file

#### Scenario: Export file is named by timestamp
- **WHEN** the user exports the extension state
- **THEN** the downloaded file is named in the format `YYYY-MM-DD-HH-mm-bookmark-desktop.json`

#### Scenario: The last opened folder is not exported
- **WHEN** the user exports the extension state while a folder is recorded as the last opened folder
- **THEN** the downloaded file contains no last-opened-folder value

#### Scenario: Importing does not change the last opened folder
- **WHEN** the user imports an exported state file
- **THEN** the profile's recorded last opened folder is left exactly as it was before the import

#### Scenario: The measured grid capacity is not exported
- **WHEN** the user exports the extension state while a grid capacity is recorded from a new-tab page measurement
- **THEN** the downloaded file contains no measured-capacity value

#### Scenario: Importing does not change the measured grid capacity
- **WHEN** the user imports an exported state file
- **THEN** the profile's recorded measured capacity is left exactly as it was before the import, and subsequent placements use the importing machine's own measurement
