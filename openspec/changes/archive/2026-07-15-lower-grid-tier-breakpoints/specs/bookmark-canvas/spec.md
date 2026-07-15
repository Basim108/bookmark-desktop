## MODIFIED Requirements

### Requirement: Responsive Grid Sizing
The system SHALL size grid cells (and thereby bookmark icons) using a fixed, unconfigurable 3-tier step function of the canvas's own available width, and SHALL derive grid capacity (columns and rows) by dividing available width and height by the resulting tier size and rounding down, with no further stretching of icon size to fill leftover space. Each tier of this step function SHALL also fix a corresponding bookmark-label font-size, resolved together with the tier's icon size so the two can never independently disagree for the same available width.

#### Scenario: Smallest tier below 512px
- **WHEN** the canvas's available width is below 512px
- **THEN** grid cells and bookmark icons render at 80px, and bookmark labels render at 0.75rem

#### Scenario: Middle tier from 512px up to 1024px
- **WHEN** the canvas's available width is at least 512px and below 1024px
- **THEN** grid cells and bookmark icons render at 106px, and bookmark labels render at 0.85rem

#### Scenario: Largest tier at 1024px and wider
- **WHEN** the canvas's available width is at least 1024px
- **THEN** grid cells and bookmark icons render at 166px, and bookmark labels render at 1rem

#### Scenario: Capacity derived by floor division
- **WHEN** the grid's current tier icon size and the canvas's available width and height are known
- **THEN** the number of columns is the available width divided by the tier icon size rounded down, and the number of rows is the available height divided by the tier icon size rounded down

#### Scenario: Leftover space is not used to stretch icons
- **WHEN** the available width or height does not divide evenly by the tier icon size
- **THEN** the remaining space is left unused rather than growing icon size beyond the tier value
