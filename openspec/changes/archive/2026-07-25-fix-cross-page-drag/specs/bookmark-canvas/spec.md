## MODIFIED Requirements

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
