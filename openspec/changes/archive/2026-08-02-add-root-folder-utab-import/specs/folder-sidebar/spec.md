## ADDED Requirements

### Requirement: Folder Row Controls Are Distinctly Targetable
The system SHALL render each folder row's action controls — import, add-subfolder, and settings — with a pointer target of at least 24x24 CSS pixels, separated from one another by at least 6 pixels, and SHALL highlight the individual control under the pointer or keyboard focus distinctly from the row-wide highlight.

These controls sit adjacent at the row's right edge, so an undersized or touching target means the user presses a neighbouring action instead of the one they aimed at — a mis-press that, for import, starts an operation that creates bookmarks. 24 pixels is the WCAG 2.2 minimum pointer target size.

The target SHALL be grown by padding around the glyph, not by enlarging the glyph: the settings glyph's 16px font size is fixed by the Folder Sidebar Row Presentation requirement and SHALL be unaffected.

The per-control highlight is in addition to, and SHALL NOT replace, the row-wide highlight required by Folder Row Hover Affordance.

#### Scenario: Controls meet the minimum target size
- **WHEN** a folder row's action controls render
- **THEN** each occupies a pointer target of at least 24x24 CSS pixels

#### Scenario: Adjacent controls are separated
- **WHEN** two action controls render next to each other on the same row
- **THEN** at least 6 pixels separate them, so neither is pressed when the other is aimed at

#### Scenario: Growing the target does not grow the glyph
- **WHEN** a folder row's action controls render
- **THEN** their glyphs are still displayed at a 16px font size

#### Scenario: The control under the pointer is highlighted on its own
- **WHEN** the pointer is over one of a row's action controls
- **THEN** that control shows a highlight distinct from its neighbours, which remain unhighlighted, while the row-wide highlight is still shown

#### Scenario: A keyboard-focused control is highlighted the same way
- **WHEN** one of a row's action controls receives keyboard focus
- **THEN** it shows the same distinct highlight as pointer hover

#### Scenario: A disabled control is not highlighted
- **WHEN** the pointer is over an action control that is disabled because an import is in flight
- **THEN** that control shows no highlight, so it does not appear pressable

## MODIFIED Requirements

### Requirement: Root Folders Are Non-Editable Drop Targets
The system SHALL treat root folders (Chrome's protected top-level folders rendered at the top level of the sidebar tree — Bookmarks Bar, Other Bookmarks, Mobile Bookmarks) as non-editable: the system SHALL NOT render a settings (gear) toggle button on a root folder's row, and there SHALL be no way to open a settings window, rename, upload/remove an image for, or remove a root folder from the sidebar. Root folders SHALL, however, render the add-subfolder button so a new subfolder can be created inside them. Root folders SHALL remain valid drop targets, accepting a bookmark or a non-root folder dragged onto them, moved via the `chrome.bookmarks` API.

Non-editability governs a root folder's *own* properties. It SHALL NOT be read as a prohibition on creating children inside a root: the add-subfolder button above is one such operation, and importing is another. A root folder's row SHALL additionally render an import button, positioned immediately before the add-subfolder button, labelled for assistive technology and carrying the tooltip `Import uTab Bookmarks`. Activating it SHALL begin the root import flow defined by the `bookmark-import` capability. This button SHALL NOT open the folder settings window, and its presence SHALL NOT otherwise weaken any prohibition above.

Non-root folder rows SHALL NOT render this button. They reach the same operation through the import control inside their settings window, and duplicating it on the row would give one operation two entry points while adding a third always-present control to every row of a sidebar whose minimum width is 40px.

#### Scenario: Root folder row has no settings button
- **WHEN** a root folder's sidebar row renders
- **THEN** it does not display a settings (gear) toggle button, and its settings window cannot be opened

#### Scenario: Root folder row can add a subfolder
- **WHEN** a root folder's sidebar row is hovered or focused
- **THEN** it reveals the add-subfolder button, and activating it opens a new-folder draft targeting a subfolder of that root folder

#### Scenario: A bookmark can be dropped into a root folder
- **WHEN** the user drags a bookmark from the canvas and drops it onto a root folder row
- **THEN** the bookmark is moved into that root folder via the bookmarks API

#### Scenario: A non-root folder can be dropped into a root folder
- **WHEN** the user drags a non-root folder row and drops it onto a root folder row
- **THEN** the dragged folder becomes a child of that root folder via the bookmarks API

#### Scenario: Root folder row offers an import button
- **WHEN** a root folder's sidebar row is hovered or focused
- **THEN** it reveals an import button immediately before the add-subfolder button, whose tooltip reads `Import uTab Bookmarks`, following the same at-rest-hidden behaviour as the row's other controls

#### Scenario: The import button does not open a settings window
- **WHEN** the user activates the import button on a root folder's row
- **THEN** the root import flow begins and no folder settings window is opened

#### Scenario: Non-root folder rows have no import button
- **WHEN** a non-root folder's sidebar row renders
- **THEN** it displays no import button, and its only import entry point remains the control inside its settings window
