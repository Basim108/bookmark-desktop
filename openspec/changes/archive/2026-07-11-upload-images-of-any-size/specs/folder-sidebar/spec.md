## MODIFIED Requirements

### Requirement: Folder Sidebar Display Setting
The system SHALL allow each folder to independently configure its sidebar row display as icon-only, label-only, or both icon and label, with no inheritance from other folders, presented in a popup anchored to that folder's settings toggle button rather than as an inline panel that reflows sibling or descendant rows. The icon display option SHALL be unavailable until the folder has a custom uploaded image. Folder names SHALL NOT be empty or consist only of whitespace. The popup SHALL close when the user clicks outside it or presses the Escape key, and SHALL allow only one folder's settings popup to be open at a time across the sidebar. When the folder has a custom uploaded image, the popup SHALL display a preview of that image sized according to the browser window's viewport width — 32px below 1024px, 48px from 1024px up to (but not including) 1600px, and 64px at 1600px and above. When a folder's sidebar row displays its custom icon (icon-only or icon+label mode), the row's icon SHALL be sized according to the browser window's viewport width — 24px below 1024px and 32px at 1024px and above — independent of and unaffected by the popup preview's sizing.

#### Scenario: Icon display unavailable without a custom image
- **WHEN** a folder has no custom uploaded image
- **THEN** the icon-only and icon+label display options are disabled for that folder

#### Scenario: Icon display available with a custom image
- **WHEN** a folder has a custom uploaded image
- **THEN** the user can set that folder's sidebar display to icon-only, label-only, or both

#### Scenario: Empty or whitespace-only folder name rejected
- **WHEN** the user attempts to save a folder name that is empty or contains only whitespace
- **THEN** the system rejects the change

#### Scenario: Opening settings shows a popup instead of reflowing the tree
- **WHEN** the user clicks a folder's settings toggle button
- **THEN** the display-mode and icon-upload controls appear in a popup anchored to that button, and sibling and descendant folder rows do not shift position

#### Scenario: Clicking outside the popup closes it
- **WHEN** the folder settings popup is open and the user clicks anywhere outside the popup
- **THEN** the popup closes

#### Scenario: Pressing Escape closes the popup
- **WHEN** the folder settings popup is open and the user presses the Escape key
- **THEN** the popup closes

#### Scenario: Opening another folder's popup closes the previous one
- **WHEN** a folder's settings popup is open and the user clicks a different folder's settings toggle button
- **THEN** the first folder's popup closes and the newly selected folder's popup opens

#### Scenario: Icon preview appears with a custom image
- **WHEN** the settings popup opens for a folder that has a custom uploaded image
- **THEN** the popup displays a preview of that image

#### Scenario: No icon preview without a custom image
- **WHEN** the settings popup opens for a folder that has no custom uploaded image
- **THEN** the popup does not display an icon preview

#### Scenario: Icon preview sized 32px on small screens
- **WHEN** the settings popup is open with an icon preview and the browser window's viewport width is below 1024px
- **THEN** the preview renders at 32px

#### Scenario: Icon preview sized 48px on medium-to-large screens
- **WHEN** the settings popup is open with an icon preview and the browser window's viewport width is at least 1024px and below 1600px
- **THEN** the preview renders at 48px

#### Scenario: Icon preview sized 64px on ultra-large screens
- **WHEN** the settings popup is open with an icon preview and the browser window's viewport width is at least 1600px
- **THEN** the preview renders at 64px

#### Scenario: Sidebar row icon sized 24px on small screens
- **WHEN** a folder's sidebar row displays its custom icon and the browser window's viewport width is below 1024px
- **THEN** the row's icon renders at 24px

#### Scenario: Sidebar row icon sized 32px at and above the breakpoint
- **WHEN** a folder's sidebar row displays its custom icon and the browser window's viewport width is at least 1024px
- **THEN** the row's icon renders at 32px

#### Scenario: Sidebar row icon size is independent of the popup preview
- **WHEN** the browser window's viewport width is at least 1600px
- **THEN** a folder's sidebar row icon renders at 32px, not the 64px used by the settings popup preview at that width
