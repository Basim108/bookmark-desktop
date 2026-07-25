## MODIFIED Requirements

### Requirement: Folder Selection Filtering
The system SHALL set the canvas's active folder to whichever folder the user selects in the sidebar, and SHALL persist that folder as the last opened folder in local extension storage each time the user selects one.

#### Scenario: Selecting a folder in the sidebar updates the canvas
- **WHEN** the user selects a folder in the sidebar
- **THEN** the canvas becomes filtered to that folder's direct bookmark children

#### Scenario: Selecting a folder records it as the last opened folder
- **WHEN** the user selects a folder in the sidebar
- **THEN** that folder is written to local extension storage as the last opened folder, replacing any previously stored value

## ADDED Requirements

### Requirement: Last Opened Folder Restored on Load
When a new-tab page loads, the system SHALL make the last opened folder — as recorded in local extension storage — its active folder, including after the browser has been closed and reopened. When no last opened folder has been recorded, or when the recorded folder no longer resolves to an existing bookmark folder, the system SHALL fall back to the first root folder and SHALL NOT overwrite the recorded value with that fallback. The system SHALL NOT display canvas content for any folder before restoration has resolved, so no new-tab page paints a different folder first.

#### Scenario: A new tab opens on the last opened folder
- **WHEN** the user selects a folder and later opens a new-tab page
- **THEN** the new page's active folder is the folder that was last selected, and the canvas shows that folder's direct bookmark children

#### Scenario: The last opened folder survives a browser restart
- **WHEN** the user selects a folder, closes every tab and the browser, then reopens the browser and opens a new-tab page
- **THEN** the new page's active folder is the folder that was last selected

#### Scenario: First run with nothing recorded
- **WHEN** a new-tab page loads and no last opened folder has ever been recorded
- **THEN** the first root folder is the active folder

#### Scenario: Recorded folder no longer exists
- **WHEN** a new-tab page loads and the recorded last opened folder does not resolve to an existing bookmark folder — because it was deleted, or because its id was reassigned in this profile
- **THEN** the first root folder becomes the active folder, and the recorded value is left unchanged rather than being overwritten with the fallback

#### Scenario: Recorded id resolves to a bookmark rather than a folder
- **WHEN** a new-tab page loads and the recorded id resolves to a bookmark instead of a folder
- **THEN** the first root folder becomes the active folder

#### Scenario: No canvas content is shown before restoration resolves
- **WHEN** a new-tab page is loading and restoration of the last opened folder has not yet resolved
- **THEN** the canvas does not render any folder's bookmarks, and in particular does not first render the first root folder's bookmarks and then switch

### Requirement: Last Opened Folder Does Not Propagate to Open Tabs
Restoration of the last opened folder SHALL apply only when a new-tab page loads. The system SHALL NOT change the active folder of an already-open new-tab page when the user selects a folder in a different tab, and SHALL NOT subscribe to storage-change notifications for the last opened folder. This is a deliberate exception to the extension's live cross-tab synchronisation of bookmark structure and layout.

#### Scenario: Selecting a folder in one tab leaves other open tabs alone
- **WHEN** two new-tab pages are open on different folders and the user selects a third folder in one of them
- **THEN** the other open page keeps showing its own active folder, and its sidebar selection is unchanged

#### Scenario: The most recent selection anywhere wins for the next new tab
- **WHEN** the user selects one folder in a first tab, then selects a different folder in a second tab, then opens a new-tab page
- **THEN** the new page opens on the folder selected second

#### Scenario: Restoring does not re-record the folder
- **WHEN** a new-tab page loads and restores the recorded last opened folder without the user selecting anything
- **THEN** no new value is written to storage, and the recorded last opened folder is unchanged

### Requirement: Restored Folder Revealed by Expanding Its Ancestors
When a new-tab page restores a last opened folder that is nested below a root folder, the system SHALL expand that folder's ancestor folders in the sidebar so its row is visible and its active highlight can be seen without the user expanding anything. The system SHALL NOT expand the restored folder itself, and SHALL NOT persist expansion state — the expanded ancestors SHALL be derived from the restored folder and applied only as the sidebar's initial expansion, after which expanding and collapsing remain entirely under user control for the rest of the session.

#### Scenario: A nested restored folder is visible in the sidebar
- **WHEN** a new-tab page restores a last opened folder nested several levels below a root folder
- **THEN** every ancestor folder between the root folder and the restored folder is expanded, and the restored folder's row is visible and shown as active

#### Scenario: The restored folder's own children stay collapsed
- **WHEN** a new-tab page restores a last opened folder that itself contains subfolders
- **THEN** the restored folder's row is visible and active, and its own subfolders are not expanded

#### Scenario: A restored root folder needs no expansion
- **WHEN** a new-tab page restores a last opened folder that is a root folder
- **THEN** its row is shown as active and no folder is expanded to reveal it

#### Scenario: Ancestors can be collapsed after restoration
- **WHEN** a new-tab page has restored a nested folder and expanded its ancestors, and the user then collapses one of those ancestors
- **THEN** that ancestor collapses and stays collapsed, and is not re-expanded by the restoration

#### Scenario: Expansion is not carried across page loads
- **WHEN** the user expands folders unrelated to the active folder and then opens a new-tab page
- **THEN** the new page expands only the restored folder's ancestors, and the unrelated folders are collapsed
