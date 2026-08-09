## ADDED Requirements

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
