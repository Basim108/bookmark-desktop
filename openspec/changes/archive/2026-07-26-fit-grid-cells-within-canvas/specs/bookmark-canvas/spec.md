## MODIFIED Requirements

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

## ADDED Requirements

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
