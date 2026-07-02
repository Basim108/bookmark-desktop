## ADDED Requirements

### Requirement: Bookmark Desktop Canvas Display
The system SHALL display, on the new-tab page canvas, only the direct bookmark children of the currently selected folder, rendered as icons, and SHALL navigate the current tab to a bookmark's URL when its icon is clicked.

#### Scenario: Selecting a folder shows only its direct bookmarks
- **WHEN** a folder is selected
- **THEN** the canvas displays icons for that folder's direct bookmark children only, excluding subfolders and nested folders' bookmarks

#### Scenario: Clicking a bookmark navigates
- **WHEN** the user clicks a bookmark icon
- **THEN** the current tab navigates to that bookmark's URL

### Requirement: Grid Pagination
The system SHALL paginate a folder's bookmarks into pages when the bookmark count exceeds one page's grid capacity, navigable as a carousel.

#### Scenario: Folder exceeds one page's capacity
- **WHEN** a folder's bookmark count exceeds the current grid's rows × cols capacity
- **THEN** the canvas splits the bookmarks across multiple navigable pages

### Requirement: Auto Grid Sizing
In auto mode, the system SHALL derive grid cell size from a formula based on available viewport size and a configurable maximum icon size: icons scale continuously with window resize while below that maximum; once at maximum size, further widening SHALL add columns and further heightening SHALL add rows.

#### Scenario: Icon scales below maximum size
- **WHEN** the window is resized and icons are below the configured maximum size
- **THEN** icon size scales continuously to fit the new viewport, without changing column/row count

#### Scenario: Window widens beyond maximum icon size
- **WHEN** the window widens while icons are already at maximum size
- **THEN** the grid adds columns instead of growing icon size further

#### Scenario: Window heightens beyond maximum icon size
- **WHEN** the window heightens while icons are already at maximum size
- **THEN** the grid adds rows instead of growing icon size further

### Requirement: Fixed Grid Sizing
In fixed mode, the system SHALL use a user-configured rows × cols count that does not change with window size; only icon size SHALL scale with the viewport, down to a configured minimum size, below which the canvas SHALL become scrollable instead of shrinking icons further.

#### Scenario: Fixed grid ignores window size for cell count
- **WHEN** a folder uses fixed grid mode and the window is resized
- **THEN** the number of rows and columns does not change; only icon size scales

#### Scenario: Icon reaches minimum size in fixed mode
- **WHEN** the window shrinks enough that fixed-mode icons would go below their configured minimum size
- **THEN** icon size stops shrinking and the canvas becomes scrollable

### Requirement: Grid Settings Inheritance
The system SHALL resolve a folder's grid settings (mode, max/min icon size, fixed rows × cols) by checking the folder's own override first, then its nearest ancestor folder's override, then a global default.

#### Scenario: Folder inherits ancestor's setting
- **WHEN** a folder has no grid-settings override and its parent folder has one
- **THEN** the folder uses its parent's grid settings

#### Scenario: Folder overrides inherited setting
- **WHEN** a folder has its own grid-settings override
- **THEN** that override is used regardless of ancestor or global settings

### Requirement: Column Growth Backfill
When auto-mode column count increases, the system SHALL backfill the newly created cells by pulling subsequent items forward from later pages, cascading across pages as needed, which may reduce the number of pages.

#### Scenario: Adding columns pulls items from the next page
- **WHEN** the grid gains columns and a later page has items
- **THEN** those newly created cells are filled with items pulled forward from the next page(s), cascading until pages are refilled or exhausted

### Requirement: Row Growth Leaves Empty Cells
When auto-mode row count increases, the system SHALL NOT backfill the newly created cells; they SHALL remain empty.

#### Scenario: Adding rows creates empty cells
- **WHEN** the grid gains rows
- **THEN** the newly created cells remain empty; no items are pulled forward to fill them

### Requirement: Grid Shrink Compaction and Cascade
When column or row count decreases and existing items are displaced, the system SHALL first compact displaced items into any empty cells already present on the same page, and only push remaining overflow to the next page (cascading across subsequent pages) once the page has no empty cells left.

#### Scenario: Displaced items compact into empty cells on the same page
- **WHEN** the grid loses columns or rows and a page has empty cells available
- **THEN** displaced items are moved into those empty cells before anything is pushed to another page

#### Scenario: Displaced items overflow to next page when page is full
- **WHEN** a page has no empty cells left to absorb displaced items
- **THEN** the remaining displaced items are pushed to the next page, cascading further if that page is also full

### Requirement: Position Persistence
The system SHALL store each bookmark's grid position (page, row, col) per folder, and SHALL reproduce that exact layout across new-tab page loads and browser restarts.

#### Scenario: Layout survives reopening a new tab
- **WHEN** the user closes and reopens a new tab
- **THEN** every bookmark icon in the previously viewed folder appears in its previously stored position

### Requirement: Next-Free-Cell Placement
The system SHALL place a bookmark into the next free grid cell of its folder whenever it newly appears there — on first run (using Chrome's bookmark order only to determine the one-time seeding sequence), when freshly created, or when moved in from another folder (including a folder it previously occupied) — without regard to any previously stored position or Chrome's current order among existing siblings.

#### Scenario: First-run seeding uses Chrome order
- **WHEN** the extension runs for the first time and a folder has no stored positions
- **THEN** its bookmarks are assigned to cells in sequence following Chrome's bookmark order

#### Scenario: New bookmark placed in next free cell
- **WHEN** a bookmark is newly created in a folder
- **THEN** it is placed in the next free grid cell of that folder

#### Scenario: Bookmark moved into a folder placed in next free cell
- **WHEN** a bookmark is moved into a folder from another folder, including a folder it previously occupied
- **THEN** any previous stored position is discarded and it is placed in the next free grid cell of the destination folder

### Requirement: Chrome-Native Reorder Ignored
The system SHALL ignore bookmark reordering performed within Chrome's own bookmark manager (within the same parent folder) and SHALL NOT recompute stored positions in response.

#### Scenario: Reordering in Chrome's bookmark manager has no effect on canvas layout
- **WHEN** the user reorders bookmarks within the same folder using Chrome's native bookmark manager
- **THEN** the stored canvas positions of those bookmarks remain unchanged

### Requirement: Manual Drag Repositioning
The system SHALL update a bookmark's stored position immediately when the user drags its icon to a new cell within the canvas, and SHALL swap the positions of two icons when one is dropped onto a cell already occupied by another.

#### Scenario: Dragging to an empty cell sets position
- **WHEN** the user drags a bookmark icon to an empty cell
- **THEN** that bookmark's stored position is updated to the target cell

#### Scenario: Dropping onto an occupied cell swaps positions
- **WHEN** the user drags a bookmark icon and drops it onto a cell occupied by another bookmark icon
- **THEN** the two bookmarks' stored positions are swapped

### Requirement: Pinned Position Resilience Under Shrink
When a bookmark's stored cell no longer fits within the current grid due to shrinking, the system SHALL push it to an overflow page and SHALL restore it to its exact stored position once the grid regains sufficient capacity, without ever discarding or recomputing that stored position due to a temporary size constraint.

#### Scenario: Item pushed to overflow page when grid shrinks
- **WHEN** the grid shrinks below the capacity needed to display a bookmark's stored cell
- **THEN** that bookmark is pushed to an overflow page rather than having its stored position changed

#### Scenario: Item resumes original position when grid regains capacity
- **WHEN** the grid regains enough capacity to include a previously overflowed bookmark's stored cell
- **THEN** that bookmark reappears in its exact original stored position

### Requirement: Drag-to-Edge Pagination
The system SHALL auto-advance to the adjacent page when the user drags an icon to the edge of the canvas while a drag is in progress.

#### Scenario: Dragging to canvas edge advances page
- **WHEN** the user drags a bookmark icon to the edge of the canvas and holds it there
- **THEN** the canvas advances to the next or previous page as appropriate

### Requirement: Per-Bookmark Label Display
The system SHALL allow each bookmark to independently configure whether its name is shown under its icon or only as a tooltip, defaulting to shown-under-icon, with no inheritance from its containing folder.

#### Scenario: Default label display
- **WHEN** a bookmark has no explicit label-display setting
- **THEN** its name is shown under its icon

#### Scenario: Per-bookmark override does not affect siblings
- **WHEN** the user sets one bookmark's label display to tooltip-only
- **THEN** other bookmarks in the same folder retain their own independent label-display settings

### Requirement: Live Cross-Tab Layout Sync
The system SHALL propagate layout changes (position updates, grid-setting changes) live to all currently open new-tab pages within the same browser profile.

#### Scenario: Drag in one tab reflects in another open tab
- **WHEN** the user drags an icon to a new position in one open new-tab page
- **THEN** all other currently open new-tab pages update to reflect the new position without requiring a manual reload
