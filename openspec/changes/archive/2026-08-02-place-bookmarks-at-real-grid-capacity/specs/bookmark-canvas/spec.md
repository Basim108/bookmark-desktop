## MODIFIED Requirements

### Requirement: Next-Free-Cell Placement
The system SHALL place a bookmark into the next free grid cell of its folder whenever it newly appears there — on first run (using Chrome's bookmark order only to determine the one-time seeding sequence), when freshly created, or when moved in from another folder (including a folder it previously occupied) — without regard to any previously stored position or Chrome's current order among existing siblings.

"Next free cell" SHALL be computed against the most recently measured page grid capacity, so that every context placing a bookmark uses the same capacity the canvas actually renders at. The system SHALL persist the capacity a new-tab page measures, and every placement — including those performed outside a new-tab page, such as by the background service worker responding to a bookmark created by Chrome's own UI or arriving via sync — SHALL read that persisted value rather than assume a capacity of its own.

The persisted capacity SHALL be a single global value, not per folder, because capacity derives from canvas geometry that no folder varies. It SHALL be last-measured-wins: when new-tab pages at different window sizes each measure a capacity, the most recent measurement is authoritative and the system SHALL NOT attempt to reconcile them.

Until a new-tab page has measured a capacity at least once — which on a fresh profile can precede any bookmark creation — the system SHALL place against a fixed bootstrap capacity.

Positions stored before a capacity was persisted SHALL NOT be recomputed. Placement is corrected going forward only; the system SHALL NOT repack a folder's existing positions in response to this behaviour.

#### Scenario: First-run seeding uses Chrome order
- **WHEN** the extension runs for the first time and a folder has no stored positions
- **THEN** its bookmarks are assigned to cells in sequence following Chrome's bookmark order

#### Scenario: New bookmark placed in next free cell
- **WHEN** a bookmark is newly created in a folder
- **THEN** it is placed in the next free grid cell of that folder

#### Scenario: Bookmark moved into a folder placed in next free cell
- **WHEN** a bookmark is moved into a folder from another folder, including a folder it previously occupied
- **THEN** any previous stored position is discarded and it is placed in the next free grid cell of the destination folder

#### Scenario: Placement outside the new-tab page uses the measured capacity
- **WHEN** a new-tab page has measured a grid capacity larger than the bootstrap capacity, and a bookmark is then created in a folder by something other than that page
- **THEN** it is placed against the measured capacity, occupying a cell the canvas actually renders on the current page rather than being pushed onto a later page

#### Scenario: A page fills to its real capacity before overflowing
- **WHEN** a folder receives more bookmarks than the bootstrap capacity holds, at a window whose measured capacity is larger
- **THEN** the first page is filled to its measured capacity before any bookmark is placed on a following page

#### Scenario: Placement before any capacity has been measured
- **WHEN** a bookmark is created in a profile where no new-tab page has ever measured a grid capacity
- **THEN** it is placed against the bootstrap capacity, and no placement is deferred or rejected for want of a measurement

#### Scenario: The most recent measurement wins
- **WHEN** one new-tab page measures a capacity and another new-tab page at a different window size subsequently measures a different capacity
- **THEN** bookmarks created afterwards are placed against the capacity measured most recently

#### Scenario: Existing positions are left alone
- **WHEN** a folder holds bookmarks positioned against a smaller capacity than the one now measured
- **THEN** those stored positions are unchanged, and the bookmarks remain on the pages and cells they were already stored in
