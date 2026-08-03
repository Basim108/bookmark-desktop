## MODIFIED Requirements

### Requirement: Import Report Records Non-Fatal Icon Failures
A `preview` that is absent, fails to decode, or fails icon validation SHALL NOT
skip its folder or bookmark, and the system SHALL record the failure as a
`warning` row in the report rather than discarding it silently. The item SHALL
still be created and SHALL fall back to its default icon.

The warning row SHALL identify which failure occurred, in its `error` column,
using one of:

| value | meaning |
| --- | --- |
| `undecodable-preview` | the `preview` is not a decodable base64 data URL — either not a data URL at all, or a payload that does not decode |
| `unsupported-format` | the preview decodes but is not one of the accepted image formats |
| `file-too-large` | the preview decodes and is an accepted format but exceeds the icon size cap |

Recording only that an icon failed leaves the user with nothing to act on: the
report file exists so a failure can be traced back to its entry, and a row that
names no cause is a dead end. The two validation values are the same names the
system already uses for those conditions elsewhere; they are not a vocabulary
specific to the report.

An absent `preview` SHALL NOT produce a row at all — there is nothing to report
about an entry that never carried an icon.

This SHALL apply identically to a folder's preview and a bookmark's preview.

#### Scenario: An unusable preview is imported as a warning
- **WHEN** a bookmark's `preview` fails to decode or fails icon validation
- **THEN** the bookmark is still created with its default icon, and a `warning` row recording the failure appears in the report

#### Scenario: An icon warning is not counted as a skip
- **WHEN** an import records only icon warnings and no skipped entries
- **THEN** the summary reports zero skipped entries and the report file is still downloaded

#### Scenario: An undecodable preview names itself
- **WHEN** an entry's `preview` is not a decodable base64 data URL
- **THEN** its warning row's `error` column reads `undecodable-preview`

#### Scenario: An unsupported image format names itself
- **WHEN** an entry's `preview` decodes but is not an accepted image format
- **THEN** its warning row's `error` column reads `unsupported-format`

#### Scenario: An oversized preview names itself
- **WHEN** an entry's `preview` decodes to an accepted format but exceeds the icon size cap
- **THEN** its warning row's `error` column reads `file-too-large`

#### Scenario: A folder's preview failure is reported the same way
- **WHEN** a folder's `preview` fails for any of the three reasons
- **THEN** its warning row names that reason in the `error` column, exactly as a bookmark's would

#### Scenario: An entry with no preview produces no row
- **WHEN** an entry carries no `preview` at all
- **THEN** no warning row is recorded for it
