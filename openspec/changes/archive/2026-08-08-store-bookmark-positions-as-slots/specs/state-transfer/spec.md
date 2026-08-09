## MODIFIED Requirements

### Requirement: Id-Free, Versioned Export Format
The exported file SHALL embed each item's state inline within its node in the
bookmark tree, keyed by structural position rather than by any Chrome bookmark
id, so it can be restored after Chrome reassigns ids. The top level SHALL group
nodes under the well-known protected-root ids (`1`, `2`, `3`), and each such root
SHALL record its display title as read from the live bookmark tree. The file
SHALL carry a format `version` string in `x.y.z` form, stamped from a single
source-of-truth constant, where `x` denotes a breaking format change, `y` an
additive feature, and `z` a bug fix.

Each bookmark node SHALL record its grid position as a `slot` integer. For
compatibility with importers predating slots, each bookmark node SHALL ALSO
record the equivalent `position` object derived from that slot at a fixed
reference capacity. This addition SHALL be additive only: it SHALL raise the
minor version and SHALL NOT raise the major version, so files written by earlier
versions of this format remain importable.

An importer SHALL prefer `slot` when the field is present, and SHALL fall back to
converting a `position` object at the same fixed reference capacity when it is
not.

#### Scenario: No Chrome ids appear as state keys
- **WHEN** the extension state is exported
- **THEN** each folder's and bookmark's settings, position, and icon are stored inline on that node, and no part of the file keys state by a Chrome-assigned bookmark id

#### Scenario: Each root records its title
- **WHEN** the extension state is exported
- **THEN** each protected root in the file carries its display title (e.g. the Bookmarks bar's title) as read from the live bookmark tree

#### Scenario: File carries a semantic version
- **WHEN** the extension state is exported
- **THEN** the file includes a `version` field in `x.y.z` form matching the exporter's current format-version constant

#### Scenario: Export carries both slot and derived position
- **WHEN** the extension state is exported
- **THEN** every bookmark node carries a `slot` integer and a `position` object equivalent to that slot at the fixed reference capacity

#### Scenario: A file predating slots still imports
- **WHEN** a file written before slots existed, carrying `position` objects and no `slot` fields, is imported
- **THEN** the import is accepted on major-version grounds and each bookmark's slot is derived from its `position` at the fixed reference capacity

#### Scenario: Slot takes precedence over the compatibility field
- **WHEN** a file carrying both `slot` and `position` on a bookmark node is imported
- **THEN** the bookmark's restored position is taken from `slot`, and `position` is ignored

#### Scenario: Adding slots does not strand existing backups
- **WHEN** the export format gains the `slot` field
- **THEN** the format's major version is unchanged and files written by the previous version are still accepted by the import compatibility check
