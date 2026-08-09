# bookmark-canvas Specification

## Purpose
TBD - created by archiving change bookmark-desktop-new-tab. Update Purpose after archive.
## Requirements
### Requirement: Bookmark Desktop Canvas Display
The system SHALL display, on the new-tab page canvas, only the direct bookmark children of the currently selected folder, rendered as icons, and SHALL navigate the current tab to a bookmark's URL when its icon is clicked, provided the URL's scheme is on an explicit safe allowlist (e.g. `http:`, `https:`, `file:`). The system SHALL NOT navigate when the bookmark's URL scheme is not on that allowlist.

#### Scenario: Selecting a folder shows only its direct bookmarks
- **WHEN** a folder is selected
- **THEN** the canvas displays icons for that folder's direct bookmark children only, excluding subfolders and nested folders' bookmarks

#### Scenario: Clicking a bookmark navigates
- **WHEN** the user clicks a bookmark icon whose URL scheme is on the safe allowlist
- **THEN** the current tab navigates to that bookmark's URL

#### Scenario: Clicking a bookmark with a dangerous URL scheme does not navigate
- **WHEN** the user clicks a bookmark icon whose URL scheme is not on the safe allowlist (e.g. `javascript:`, `data:`, `chrome:`)
- **THEN** the current tab does not navigate

### Requirement: Grid Pagination
The system SHALL paginate a folder's bookmarks into pages when the bookmark count exceeds one page's grid capacity, navigable as a carousel.

#### Scenario: Folder exceeds one page's capacity
- **WHEN** a folder's bookmark count exceeds the current grid's rows × cols capacity
- **THEN** the canvas splits the bookmarks across multiple navigable pages

### Requirement: Responsive Grid Sizing
The system SHALL size grid cells (and thereby bookmark icons) using a fixed, unconfigurable 3-tier step function of the canvas's own available width. The system SHALL derive grid capacity (columns and rows) from the space cells actually consume — the tier icon size plus the inter-cell gap between adjacent cells, within the grid's own padding — such that every rendered cell is fully visible inside the canvas, with no further stretching of icon size to fill leftover space. Horizontal leftover space SHALL be distributed into the column cells themselves, keeping icons at their tier size and centred; vertical leftover space SHALL be left unused below the last row. Each tier of this step function SHALL also fix a corresponding bookmark-label font-size, resolved together with the tier's icon size so the two can never independently disagree for the same available width.

The row count is derived from the canvas's full height. The pagination controls, when displayed, occupy part of that height and are not subtracted from it, so the bottom-row guarantee below is scoped to folders that fit on a single page. Closing that gap is tracked as a follow-up (see this change's design.md) because it couples grid capacity to page count, which is itself derived from capacity.

#### Scenario: Smallest tier below 512px
- **WHEN** the canvas's available width is below 512px
- **THEN** bookmark icons render at 80px, and bookmark labels render at 0.75rem

#### Scenario: Middle tier from 512px up to 1024px
- **WHEN** the canvas's available width is at least 512px and below 1024px
- **THEN** bookmark icons render at 106px, and bookmark labels render at 0.85rem

#### Scenario: Largest tier at 1024px and wider
- **WHEN** the canvas's available width is at least 1024px
- **THEN** bookmark icons render at 166px, and bookmark labels render at 1rem

#### Scenario: Tier resolved from raw available width
- **WHEN** the tier is resolved for a given canvas
- **THEN** the tier breakpoints are compared against the canvas's full available width, not against the width remaining after the grid's padding is subtracted

#### Scenario: Capacity derived by floor division
- **WHEN** the grid's current tier icon size and the canvas's available width and height are known
- **THEN** the number of columns is the available width, less the grid's padding on both sides and plus one gap, divided by the tier icon size plus one gap, rounded down — the largest whole number `n` for which `n` icon widths plus `n − 1` gaps fit — and the number of rows is derived the same way from the available height

#### Scenario: Leftover space is not used to stretch icons
- **WHEN** the available width or height does not divide evenly by the tier icon size plus a gap
- **THEN** bookmark icons still render at exactly their tier size; the remainder never grows an icon beyond that value, whether or not it is distributed into the cells around them

#### Scenario: Capacity never drops below one cell per axis
- **WHEN** the canvas's available width or height is smaller than a single cell plus the grid's padding
- **THEN** capacity is still at least 1 column and at least 1 row

#### Scenario: Last column is fully visible
- **WHEN** a folder holds more bookmarks than one row of the canvas can display
- **THEN** every icon in the right-most occupied column is rendered entirely within the canvas's horizontal bounds, with no part clipped by the canvas edge

#### Scenario: Bottom row is fully visible when no pagination controls are shown
- **WHEN** a folder's bookmarks all fit on one page, so no pagination controls are displayed, and enough of them occupy the last row
- **THEN** every icon in the bottom-most occupied row is rendered entirely within the canvas's vertical bounds, with no part clipped by the canvas edge

#### Scenario: Horizontal leftover space is distributed into the cells
- **WHEN** the available width does not divide evenly into whole cells
- **THEN** the remaining horizontal space is distributed equally across the column cells, so each cell is wider than the tier icon size while the icon itself stays at the tier size and is centred within its cell, rather than the remainder being left unused at the right edge

#### Scenario: Distributed space remains a valid drop target
- **WHEN** a dragged bookmark is released over the space added to a cell by horizontal distribution
- **THEN** the drop resolves to that cell, exactly as a release over the icon itself would

#### Scenario: Vertical leftover space is left unused
- **WHEN** the available height does not divide evenly into whole cells
- **THEN** the rows stay anchored to the top of the canvas and the remaining vertical space is left unused below the last row, rather than being distributed between rows

### Requirement: Canvas Hides Native Scroll Controls
The system SHALL hide the canvas's native horizontal and vertical scrollbar controls while keeping the canvas scrollable by other input methods (e.g. wheel, trackpad, keyboard).

#### Scenario: No visible scrollbar when content briefly exceeds the container
- **WHEN** the canvas grid's rendered content exceeds the container's visible area
- **THEN** no native vertical or horizontal scrollbar track or thumb is rendered, but the content can still be scrolled with the wheel or trackpad

### Requirement: Cell Hover Affordance
The system SHALL highlight a square of exactly the current tier's icon size, centred within a grid cell, when the mouse hovers over a cell that contains a bookmark or when a dragged bookmark is over it, and SHALL show a pointer cursor while hovering such a cell at rest. The highlight SHALL NOT extend into the space added to the cell by horizontal leftover distribution, nor into the gap between cells, so that highlighted cells never visually touch one another. The hover and drag-over hit area SHALL remain the cell's full area, so the region that triggers the highlight matches the region that accepts a drop even though the painted highlight is smaller. The system SHALL NOT apply any hover highlight or cursor change to a grid cell that contains no bookmark.

#### Scenario: Hovering an occupied cell highlights an icon-sized square
- **WHEN** the mouse moves over a grid cell that contains a bookmark
- **THEN** a square of the current tier's icon size, centred in the cell, is highlighted, including any space around the icon and label not filled by their own content

#### Scenario: Highlight excludes distributed space and gaps
- **WHEN** a cell has been widened beyond the tier icon size by horizontal leftover distribution and the mouse hovers it
- **THEN** the added width and the gap to the adjacent cell are not highlighted, and the highlight of two adjacent occupied cells never touches

#### Scenario: Hovering an occupied cell highlights the whole cell
- **WHEN** the mouse moves over any part of a grid cell that contains a bookmark, including the space beside the icon added by horizontal leftover distribution rather than the icon itself
- **THEN** that cell shows its highlight and the cursor is a pointer — the entire cell area responds to hover, matching the area that accepts a drop, even though the painted highlight is the smaller icon-sized square

#### Scenario: Pointer cursor while hovering an occupied cell
- **WHEN** the mouse is over a grid cell that contains a bookmark and no drag is in progress
- **THEN** the cursor is a pointer

#### Scenario: Grabbing cursor while a bookmark is being dragged
- **WHEN** the user is actively dragging a bookmark icon
- **THEN** the cursor is a grabbing cursor rather than a pointer

#### Scenario: Empty cells show no hover feedback
- **WHEN** the mouse moves over a grid cell that contains no bookmark and no drag is in progress
- **THEN** the cell is not highlighted and the cursor remains the default arrow

### Requirement: Capacity-Independent Position Slots
The system SHALL store each bookmark's position as a single capacity-independent
slot index per folder, and SHALL derive the displayed cell from that slot and the
grid's current capacity, such that cells-per-page is the only property of the
grid that affects where an item is displayed.

Slot `n` SHALL be displayed on page `floor(n / cellsPerPage)`, at row
`floor((n mod cellsPerPage) / cols)` and column `(n mod cellsPerPage) mod cols`,
where `cellsPerPage = cols × rows`. Every slot SHALL therefore map to a valid
cell at every capacity; the system SHALL NOT treat any stored position as unable
to fit the current grid.

A slot that is not assigned to any bookmark SHALL be displayed as an empty cell
and SHALL retain its place in the sequence, so a gap the user created is part of
the arrangement rather than slack to be removed.

#### Scenario: The same slots produce different layouts at different capacities
- **WHEN** a folder holds bookmarks at slots 0, 1, 2, 3 and 5, with slot 4 unassigned, and the grid holds three cells per page
- **THEN** the first page shows the bookmarks at slots 0, 1 and 2, and the second page shows the bookmark at slot 3, then an empty cell, then the bookmark at slot 5

#### Scenario: Gaining a cell per page pulls the sequence forward
- **WHEN** that same folder is displayed at four cells per page
- **THEN** the first page shows the bookmarks at slots 0, 1, 2 and 3, and the second page shows an empty cell followed by the bookmark at slot 5

#### Scenario: Enough capacity collapses the trailing page entirely
- **WHEN** that same folder is displayed at six cells per page
- **THEN** a single page shows the bookmarks at slots 0, 1, 2 and 3, then an empty cell, then the bookmark at slot 5, and no second page exists

#### Scenario: Reading order is preserved at every capacity
- **WHEN** a folder's bookmarks occupy consecutive slots and the grid's capacity changes
- **THEN** the bookmarks are displayed in the same relative reading order at the new capacity, with no bookmark displayed ahead of one that precedes it in slot order

### Requirement: Reflow Depends Only on Cells Per Page
The system SHALL reflow the displayed layout identically whether cells-per-page
changed because the column count changed, the row count changed, or both. The
system SHALL NOT apply a different rule to a change in rows than to a change in
columns.

#### Scenario: Gaining a row pulls items forward like gaining a column
- **WHEN** the grid gains a row, raising cells-per-page, and a later page holds bookmarks
- **THEN** those bookmarks are displayed on the earlier page in the newly available cells, exactly as they would be had cells-per-page risen by the same amount through gaining a column

#### Scenario: Losing capacity pushes items back
- **WHEN** the grid loses columns or rows, lowering cells-per-page
- **THEN** items whose slots exceed the reduced page size are displayed on later pages, adding pages as needed

### Requirement: Position Persistence
The system SHALL store each bookmark's grid position per folder as a slot, and
SHALL reproduce that exact layout across new-tab page loads and browser restarts,
and at every window size the layout was viewed at.

#### Scenario: Layout survives reopening a new tab
- **WHEN** the user closes and reopens a new tab
- **THEN** every bookmark icon in the previously viewed folder appears in its previously stored position

#### Scenario: Layout survives a change of window size and back
- **WHEN** the user changes the window size and later returns it to a size the folder was previously viewed at
- **THEN** every bookmark icon in that folder appears in the cell it occupied at that size

### Requirement: Window Resize Never Writes Stored Positions
A change in the grid's capacity SHALL NOT modify any stored position. The system
SHALL write a bookmark's stored position only in response to a user action —
dragging it to a cell, creating it, moving it into the folder, or deleting it.

Consequently, returning the window to any previously used size SHALL redisplay
every bookmark exactly as it was displayed at that size, and this SHALL hold
regardless of intervening page reloads, folder switches, other open new-tab pages
at other window sizes, sidebar width changes, or intermediate sizes passed
through while resizing.

#### Scenario: Resizing away and back restores the exact layout
- **WHEN** the user positions a bookmark by dragging at one window size, resizes the window to any other size, and then returns the window to the original size
- **THEN** the bookmark is displayed in exactly the cell the user placed it in

#### Scenario: A reload at another size does not disturb stored positions
- **WHEN** the user resizes the window, reloads the new-tab page or switches folders and back at that size, and then returns the window to the original size
- **THEN** every bookmark is displayed in exactly the cell it occupied at that original size

#### Scenario: Passing through a larger size is not destructive
- **WHEN** the user resizes the window past a size larger than the one a bookmark was positioned at, and then returns to that size
- **THEN** the bookmark is displayed in exactly the cell the user placed it in

#### Scenario: A second page at another size does not disturb stored positions
- **WHEN** a second new-tab page is open at a different window size showing the same folder
- **THEN** neither page's rendering changes any stored position, and each page displays the folder correctly for its own capacity

### Requirement: Migration of Stored Cells to Slots
The system SHALL convert positions stored as `(page, row, col)` by an earlier
version into slots exactly once per profile, framing the conversion on the most
recently measured grid capacity, or on the bootstrap capacity when no measurement
was ever recorded. The conversion SHALL be performed under the positions lock and
SHALL be recorded, so that a second context observes the completed conversion
rather than repeating it.

#### Scenario: Existing positions are converted once
- **WHEN** a profile holding positions in the earlier `(page, row, col)` form is first read by this version
- **THEN** every folder's positions are converted to slots against the last measured capacity, and the resulting layout at that capacity matches the layout the earlier version displayed

#### Scenario: Two contexts do not convert twice
- **WHEN** a new-tab page and the background service worker both read positions for the first time after the upgrade
- **THEN** the conversion is performed once and the second context reads the converted slots

### Requirement: Next-Free-Cell Placement
The system SHALL place a bookmark into the next free slot of its folder whenever it newly appears there — on first run (using Chrome's bookmark order only to determine the one-time seeding sequence), when freshly created, or when moved in from another folder (including a folder it previously occupied) — without regard to any previously stored position or Chrome's current order among existing siblings.

"Next free slot" SHALL be the lowest non-negative integer not already assigned to a bookmark in that folder. It SHALL NOT depend on the grid's capacity, so every context that places a bookmark — including the background service worker responding to a bookmark created by Chrome's own UI or arriving via sync — SHALL produce the same result without needing to know, measure, or agree on a capacity.

Positions stored by an earlier version SHALL NOT be recomputed beyond the one-time conversion to slots. Placement is corrected going forward only; the system SHALL NOT repack a folder's existing positions in response to this behaviour.

#### Scenario: First-run seeding uses Chrome order
- **WHEN** the extension runs for the first time and a folder has no stored positions
- **THEN** its bookmarks are assigned to slots in sequence following Chrome's bookmark order

#### Scenario: New bookmark placed in next free slot
- **WHEN** a bookmark is newly created in a folder
- **THEN** it is placed in the lowest free slot of that folder

#### Scenario: Bookmark moved into a folder placed in next free slot
- **WHEN** a bookmark is moved into a folder from another folder, including a folder it previously occupied
- **THEN** any previous stored position is discarded and it is placed in the lowest free slot of the destination folder

#### Scenario: A gap left by the user is filled before any later slot
- **WHEN** a folder has an unassigned slot earlier in the sequence than its last bookmark, and a bookmark is created in that folder
- **THEN** the new bookmark takes that earlier slot rather than a slot after the last bookmark

#### Scenario: Placement outside the new-tab page needs no capacity
- **WHEN** a bookmark is created in a folder by something other than a new-tab page, whatever capacity any page has measured
- **THEN** it is placed in the lowest free slot, and the canvas displays it on the current page whenever that slot falls within the page the canvas renders

#### Scenario: A page fills to its real capacity before overflowing
- **WHEN** a folder receives more bookmarks than any bootstrap capacity would hold, at a window whose capacity is larger
- **THEN** the first page is filled to the capacity the canvas actually renders before any bookmark is displayed on a following page

#### Scenario: Placement before any page has rendered
- **WHEN** a bookmark is created in a profile where no new-tab page has ever rendered
- **THEN** it is placed in the lowest free slot, and no placement is deferred or rejected for want of a measurement

### Requirement: Chrome-Native Reorder Ignored
The system SHALL ignore bookmark reordering performed within Chrome's own bookmark manager (within the same parent folder) and SHALL NOT recompute stored positions in response.

#### Scenario: Reordering in Chrome's bookmark manager has no effect on canvas layout
- **WHEN** the user reorders bookmarks within the same folder using Chrome's native bookmark manager
- **THEN** the stored canvas positions of those bookmarks remain unchanged

### Requirement: Manual Drag Repositioning
The system SHALL update a bookmark's stored position immediately when the user drags its icon to a new cell within the canvas, and SHALL swap the positions of two icons when one is dropped onto a cell already occupied by another. This SHALL hold whether the source and target cells are on the same page or on different pages: a bookmark grabbed on one page and dropped onto a cell on another page SHALL move to that destination page's cell, and if that cell is occupied the two bookmarks' stored positions SHALL be swapped across the pages. The dragged icon SHALL remain attached to the pointer for the entire drag, including while the canvas auto-advances between pages, so the drop always lands on the cell under the pointer rather than reverting to the origin.

#### Scenario: Dragging to an empty cell sets position
- **WHEN** the user drags a bookmark icon to an empty cell
- **THEN** that bookmark's stored position is updated to the target cell

#### Scenario: Dropping onto an occupied cell swaps positions
- **WHEN** the user drags a bookmark icon and drops it onto a cell occupied by another bookmark icon
- **THEN** the two bookmarks' stored positions are swapped

#### Scenario: Dropping onto an empty cell on a different page
- **WHEN** the user drags a bookmark icon from one page to an empty cell on another page (reached via drag-to-edge advance) and drops it
- **THEN** that bookmark's stored position is updated to the destination page's cell and it appears there after the drag ends

#### Scenario: Dropping onto an occupied cell on a different page
- **WHEN** the user drags a bookmark icon from one page and drops it onto a cell occupied by another bookmark on a different page
- **THEN** the two bookmarks' stored positions are swapped, with the dragged bookmark taking the occupied destination cell and the occupant taking the dragged bookmark's original cell on its original page

#### Scenario: Cross-page swap moves the displaced bookmark to the origin page
- **WHEN** the user drags a bookmark from the first page and drops it onto the position of another bookmark on the second page
- **THEN** the dragged bookmark takes that occupied cell on the second page and the other bookmark moves to the first page, into the cell the dragged bookmark previously occupied

#### Scenario: Dragged icon survives an auto-advance page flip
- **WHEN** the canvas auto-advances to an adjacent page while a bookmark icon is being dragged
- **THEN** the dragged icon stays under the pointer (it is not dropped or reverted) and can still be positioned on the newly displayed page

### Requirement: Drag-to-Edge Pagination
The system SHALL auto-advance to the adjacent page when the user drags an icon to the edge of the canvas and holds it there while a drag is in progress. While the icon continues to be held at the same edge, the system SHALL keep advancing to successive pages one at a time (page 2, then 3, and so on), and SHALL stop advancing once the first or last page is reached. Leaving the edge SHALL cancel any pending advance.

#### Scenario: Dragging to canvas edge advances page
- **WHEN** the user drags a bookmark icon to the edge of the canvas and holds it there
- **THEN** the canvas advances to the next or previous page as appropriate

#### Scenario: Continuing to hold at the edge advances further pages
- **WHEN** the user keeps holding a dragged icon at the same canvas edge after the first advance
- **THEN** the canvas continues advancing to each successive page in that direction until the user leaves the edge or the last page in that direction is reached

#### Scenario: Traversing multiple pages in a single drag
- **WHEN** the user grabs a bookmark on the first page and holds it at the right edge long enough for the canvas to advance past the second page to the third page, then drops it on a cell there
- **THEN** the bookmark moves to the third page's cell in that one continuous drag, without the drag ending on any intermediate page

#### Scenario: Holding at the edge on the last page does not advance
- **WHEN** the user holds a dragged icon at the edge while already on the first (leftmost) or last (rightmost) page in that direction
- **THEN** the canvas does not advance further

#### Scenario: Leaving the edge cancels a pending advance
- **WHEN** the user moves a dragged icon away from the edge before the hold delay elapses
- **THEN** no page advance occurs

### Requirement: Per-Bookmark Label Display
The system SHALL allow each bookmark to independently configure whether its name is shown under its icon or only as a tooltip, defaulting to shown-under-icon, with no inheritance from its containing folder. This setting SHALL be presented inside the Edit Bookmark window as a single checkbox: checked means the name is shown under the icon, and unchecked means the name is shown only as a tooltip that appears on hover.

#### Scenario: Default label display
- **WHEN** a bookmark has no explicit label-display setting
- **THEN** its name is shown under its icon

#### Scenario: Per-bookmark override does not affect siblings
- **WHEN** the user sets one bookmark's label display to tooltip-only
- **THEN** other bookmarks in the same folder retain their own independent label-display settings

#### Scenario: Label visibility toggled via the window checkbox
- **WHEN** the user unchecks the "show label under icon" checkbox in the Edit Bookmark window and saves
- **THEN** that bookmark's name is no longer shown under its icon and instead appears only as a tooltip on hover

### Requirement: Live Cross-Tab Layout Sync
The system SHALL propagate layout changes (position updates, grid-setting changes) live to all currently open new-tab pages within the same browser profile.

#### Scenario: Drag in one tab reflects in another open tab
- **WHEN** the user drags an icon to a new position in one open new-tab page
- **THEN** all other currently open new-tab pages update to reflect the new position without requiring a manual reload

### Requirement: Canvas Data Cleanup on Removal
The system SHALL remove a bookmark's or folder's stored settings when it is removed via `chrome.bookmarks`, so that no orphaned per-item canvas data persists after removal.

#### Scenario: Removing a bookmark cleans up its settings
- **WHEN** a bookmark is removed via `chrome.bookmarks`
- **THEN** its stored bookmark settings (e.g. label-display override) are deleted

#### Scenario: Removing a folder cleans up its settings
- **WHEN** a folder is removed via `chrome.bookmarks`
- **THEN** its stored folder settings are deleted

### Requirement: Grid Fit Preserved Across Sidebar Resize
The system SHALL recompute grid capacity from the canvas's resulting available width whenever the sidebar's width changes, so that no cell is clipped at any point during or after a sidebar drag-resize. Because the canvas's measured width and the grid's rendered column count update in separate frames, the grid's column tracks SHALL be able to compress below the tier icon size, so that a frame rendered with a stale column count compresses rather than overflowing the canvas.

#### Scenario: Widening the sidebar reduces columns without clipping
- **WHEN** the user drags the sidebar's right border to make the sidebar wider, reducing the canvas's available width past a column boundary
- **THEN** the grid re-renders with fewer columns and every icon remains fully visible within the canvas

#### Scenario: Narrowing the sidebar adds columns without clipping
- **WHEN** the user drags the sidebar's right border to make the sidebar narrower, increasing the canvas's available width past a column boundary
- **THEN** the grid re-renders with more columns and every icon remains fully visible within the canvas

#### Scenario: No clipping mid-drag
- **WHEN** the sidebar is being drag-resized continuously across one or more column boundaries
- **THEN** at no intermediate width does the grid's rendered content extend beyond the canvas's horizontal bounds

#### Scenario: Sidebar resize across a tier breakpoint
- **WHEN** a sidebar resize moves the canvas's available width across a tier breakpoint
- **THEN** capacity is recomputed using the newly resolved tier's icon size, and every icon remains fully visible within the canvas

### Requirement: Position Writes Are Atomic Across Extension Contexts
Stored bookmark positions are updated by read-modify-write from more than one JavaScript context — the background service worker and every open new-tab page. The system SHALL serialize every such read-modify-write against a single lock shared by all of those contexts, so that a write built from an earlier snapshot can never discard a position another context has already committed. Any operation that reads stored positions and then writes a value derived from that read SHALL hold the lock across both the read and the write.

#### Scenario: A bookmark created during a page's initial layout keeps its position
- **WHEN** bookmarks are created while a new-tab page's first position backfill for that folder is still in flight
- **THEN** every created bookmark still has a stored position once all writes have settled, and none is silently dropped

#### Scenario: A write for one folder does not strand another folder's positions
- **WHEN** one context writes positions while another context is concurrently storing positions for a different folder
- **THEN** both folders retain all of their stored positions, because the whole-map write cannot be built from a snapshot taken before the other folder's write

#### Scenario: A newly placed bookmark never reuses an occupied cell
- **WHEN** two bookmarks are created close enough together that their placements overlap in time
- **THEN** each is assigned a distinct cell, because the cell is chosen and stored without releasing the lock in between

#### Scenario: Bulk creation from a page keeps every position
- **WHEN** many bookmarks are created in bulk from a new-tab page, as the uTab import does, while the service worker places each one
- **THEN** every created bookmark has a stored position once the import settles

### Requirement: Horizontal Wheel Pagination

The system SHALL change the displayed canvas page in response to horizontal
wheel input over the canvas: input in the rightward direction SHALL advance to
the next page, and input in the leftward direction SHALL return to the
previous page. Paging SHALL stop at the first and last page rather than
wrapping.

A single detent of a horizontal (thumb) wheel SHALL turn exactly one page, and
continued rolling SHALL keep turning pages at a bounded rate. The number of
pages turned SHALL depend on how long the input continues, never on the
magnitude of an individual event, so that a single high-magnitude burst cannot
turn more pages than a gentle one of the same duration.

The system SHALL interpret wheel input equivalently regardless of the units
the browser reports it in (pixels, lines, or pages), so the gesture behaves
the same across browsers.

The system SHALL NOT change pages in response to vertical wheel input.

The system SHALL NOT change pages in response to wheel input while a bookmark
drag is in progress; page changes during a drag remain governed by the
Drag-to-Edge Pagination requirement.

The system SHALL suppress the browser's default handling of horizontal wheel
input over the canvas, so that wheel paging never triggers browser history
navigation away from the new-tab page. This SHALL hold both while paging and
while wheel paging is suppressed during a drag.

#### Scenario: Rightward wheel input advances to the next page

- **WHEN** a folder spans multiple pages, the first page is displayed, and the user scrolls a horizontal wheel rightward over the canvas
- **THEN** the canvas displays the second page

#### Scenario: Leftward wheel input returns to the previous page

- **WHEN** a folder spans multiple pages, the second page is displayed, and the user scrolls a horizontal wheel leftward over the canvas
- **THEN** the canvas displays the first page

#### Scenario: One detent turns exactly one page

- **WHEN** the user rolls a horizontal wheel by a single detent over a folder spanning three or more pages
- **THEN** the canvas advances by exactly one page

#### Scenario: Sustained rolling keeps turning pages

- **WHEN** the user continues rolling a horizontal wheel in the same direction over a folder spanning several pages
- **THEN** the canvas keeps advancing one page at a time in that direction, at a bounded rate, until the user stops or the last page in that direction is reached

#### Scenario: A high-magnitude burst does not turn extra pages

- **WHEN** wheel input of a magnitude many times one page's worth arrives over the same span of time as a single detent
- **THEN** the canvas advances by the same number of pages as it would for that single detent, and the excess magnitude does not cause further page turns after the input stops

#### Scenario: Reversing direction takes effect immediately

- **WHEN** the user rolls a horizontal wheel in one direction and then reverses direction before a page turn is triggered
- **THEN** the accumulated input from the first direction does not delay or offset the page turn in the new direction

#### Scenario: Paging stops at the last page

- **WHEN** the last page is displayed and the user scrolls a horizontal wheel rightward over the canvas
- **THEN** the displayed page does not change and the canvas does not wrap to the first page

#### Scenario: Paging stops at the first page

- **WHEN** the first page is displayed and the user scrolls a horizontal wheel leftward over the canvas
- **THEN** the displayed page does not change and the canvas does not wrap to the last page

#### Scenario: Line-based and pixel-based wheel units behave the same

- **WHEN** equivalent horizontal wheel input is reported by the browser in line units rather than pixel units
- **THEN** the canvas turns pages the same way it does for the pixel-based equivalent

#### Scenario: Vertical wheel input does not change pages

- **WHEN** the user scrolls a vertical wheel over the canvas of a folder spanning multiple pages
- **THEN** the displayed page does not change

#### Scenario: Wheel input is ignored while dragging a bookmark

- **WHEN** the user is dragging a bookmark icon and horizontal wheel input arrives over the canvas
- **THEN** the displayed page does not change in response to that input, and the drag continues uninterrupted

#### Scenario: Wheel paging does not navigate the browser

- **WHEN** the user scrolls a horizontal wheel over the canvas, including at the first or last page where no page change occurs
- **THEN** the new-tab page remains displayed and the browser does not navigate backward or forward in history

#### Scenario: Single-page folders ignore wheel input

- **WHEN** a folder's bookmarks all fit on one page and the user scrolls a horizontal wheel over the canvas
- **THEN** the displayed page does not change and the browser does not navigate

