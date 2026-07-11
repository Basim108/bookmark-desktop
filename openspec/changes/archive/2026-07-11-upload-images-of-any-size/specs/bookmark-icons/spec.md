## MODIFIED Requirements

### Requirement: Upload Size and Dimension Limits
The system SHALL enforce a configured maximum file size on uploaded icon images, rejecting uploads that exceed it. The system SHALL NOT impose any maximum pixel dimension on uploaded icon images.

#### Scenario: Oversized file is rejected
- **WHEN** an uploaded icon file exceeds the configured maximum file size
- **THEN** the system rejects the upload

#### Scenario: Large pixel dimensions are accepted
- **WHEN** an uploaded icon file is within the maximum file size but has pixel dimensions larger than 512×512
- **THEN** the system accepts the upload
