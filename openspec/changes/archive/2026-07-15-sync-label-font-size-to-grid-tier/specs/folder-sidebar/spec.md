## ADDED Requirements

### Requirement: Folder Label Font Size Follows Grid Tier
The system SHALL render folder row names at a font-size that matches the canvas grid's current tier — 0.75rem when the grid is at its 80px tier, 0.85rem at its 106px tier, and 1rem at its 166px tier — independent of the sidebar's own separate width-tiering system.

#### Scenario: Folder label matches the grid's smallest tier
- **WHEN** the canvas grid is at its 80px tier
- **THEN** folder row names render at 0.75rem

#### Scenario: Folder label matches the grid's middle tier
- **WHEN** the canvas grid is at its 106px tier
- **THEN** folder row names render at 0.85rem

#### Scenario: Folder label matches the grid's largest tier
- **WHEN** the canvas grid is at its 166px tier
- **THEN** folder row names render at 1rem

#### Scenario: Folder label size is unaffected by sidebar width
- **WHEN** the user resizes the sidebar without changing the canvas grid's tier
- **THEN** folder row label font-size does not change
