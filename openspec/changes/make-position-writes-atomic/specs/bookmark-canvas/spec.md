## ADDED Requirements

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
