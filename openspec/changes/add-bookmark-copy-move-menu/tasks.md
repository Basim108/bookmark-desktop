## 1. Bookmark Copy and Folder Data Foundations

- [x] 1.1 Add complete-record bookmark settings read/write or clone APIs that preserve unknown future fields, with unit tests proving whole-record copying rather than field-by-field reconstruction.
- [x] 1.2 Add a centralized bookmark-owned metadata clone operation covering the complete settings record and optional IndexedDB icon, with tests for default settings, custom settings, missing icons, and custom icons.
- [x] 1.3 Add the bookmark copy orchestration that snapshots source metadata, creates a new Chrome bookmark, clones all owned metadata, excludes position, and returns the new node.
- [x] 1.4 Add compensation and error results for partial copy failures, including removal-cascade rollback and explicit reporting when rollback itself fails.
- [x] 1.5 Add copy-operation tests proving the source remains unchanged, duplicate URLs can exist across folders, future settings fields survive, and the destination receives no copied position.

## 2. Folder Picker Model and Search

- [x] 2.1 Add a folder-tree projection utility that produces selectable hierarchy nodes and stable full root-to-folder paths keyed by bookmark id.
- [x] 2.2 Add case-insensitive, trimmed substring filtering against folder names only, returning a flat list of matching full-path entries, with tests for nesting, duplicate names, whitespace, case differences, and no matches.
- [x] 2.3 Build the reusable Copy/Move destination window with an expandable tree, search field, flat search results, no-results state, restored expansion state after clearing search, and operation-specific title.
- [x] 2.4 Enforce destination validity and submission state: disable OK before selection, for the current folder, and while running; support Cancel, close, Escape, success dismissal, and inline failures.
- [x] 2.5 Add accessible interaction tests for folder selection, disabled current-folder confirmation in both modes, search results with full paths, state restoration, focus, cancellation, loading, and errors.

## 3. Bookmark Action Menu and Integration

- [x] 3.1 Build an anchored `BookmarkActionMenu` with Copy To, Move To, separator, and Settings in the specified order, including viewport-aware placement.
- [x] 3.2 Implement menu accessibility and lifecycle behavior: menu semantics, initial focus, arrow-key navigation, Enter activation, outside-click dismissal, Escape dismissal, and focus restoration to the gear.
- [x] 3.3 Integrate the menu into `BookmarkIcon`, keep the gear visible while the menu is open, route Settings to the existing Edit Bookmark window, and route Copy/Move to the shared destination window.
- [x] 3.4 Connect Copy confirmation to the new copy operation and Move confirmation to `moveNodeToFolder`, relying on existing bookmark events for destination placement and UI resynchronization.
- [x] 3.5 Update bookmark icon and integration tests for the new gear behavior, menu order, settings path, copy flow, move flow, failure behavior, and prevention of duplicate submissions.

## 4. Styling, End-to-End Verification, and Documentation

- [x] 4.1 Add responsive styling for the anchored menu and modal picker, including viewport flipping, scrolling for large trees/results, selected/disabled/loading/error states, and consistency with existing windows.
- [x] 4.2 Add end-to-end coverage that copies a fully customized bookmark to another folder and verifies both independent bookmarks, copied metadata, and fresh destination placement.
- [x] 4.3 Add end-to-end coverage that moves a customized bookmark through the menu and verifies preserved identity/metadata plus fresh destination placement.
- [x] 4.4 Run focused unit/component tests, the full test suite, lint, type checking, and relevant end-to-end tests; resolve all regressions.
- [x] 4.5 Update user-facing documentation and changelog text to describe the bookmark gear menu and Copy To/Move To behavior.
