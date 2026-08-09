## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: Column Growth Backfill
**Reason**: Implemented as a dense repack that rewrote stored positions, collapsing user-created gaps and moving a deliberately placed bookmark to the end of the pack — the defect this change fixes. The intended behaviour (items pulling forward into cells the grid gained, collapsing trailing pages) is preserved and generalised by "Capacity-Independent Position Slots" and "Reflow Depends Only on Cells Per Page", now as a display-time reflow that never writes.
**Migration**: None required by users. Existing positions are converted to slots once (see "Migration of Stored Cells to Slots"); the pull-forward behaviour continues to be observable at every capacity change.

### Requirement: Row Growth Leaves Empty Cells
**Reason**: An explicitly asymmetric rule with no user-predictable basis. Reflow depends on cells-per-page, which a row change alters exactly as a column change does; preserving the asymmetry would require reintroducing a per-folder reference capacity and would forfeit exact round-tripping.
**Migration**: None. Gaining a row now pulls later items forward, reducing page count, consistent with gaining a column.

### Requirement: Grid Shrink Compaction and Cascade
**Reason**: Compaction existed to place items whose stored cell no longer fit the current grid. Under slots every position maps to a valid cell at every capacity, so no item is ever displaced and there is nothing to compact. The rule also broke reading order, displaying compacted items after items that still fit.
**Migration**: None. Losing capacity now pushes items back in slot order, preserving reading order, and user-created gaps remain visible rather than being squeezed out.

### Requirement: Pinned Position Resilience Under Shrink
**Reason**: Guaranteed position resilience in one direction only, which is what allowed growth to be treated as unconstrained and permitted the destructive repack. Superseded by "Window Resize Never Writes Stored Positions", which holds in both directions and for every pair of sizes.
**Migration**: None. The guarantee is strictly stronger: stored positions now survive every capacity change, not only shrinking ones.
