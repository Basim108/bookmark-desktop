## MODIFIED Requirements

### Requirement: Responsive Grid Sizing
The system SHALL size grid cells (and thereby bookmark icons) using a fixed, unconfigurable 3-tier step function of the canvas's own available width, and SHALL derive grid capacity (columns and rows) by dividing available width and height by the resulting tier size and rounding down, with no further stretching of icon size to fill leftover space.

#### Scenario: Smallest tier below 1660px
- **WHEN** the canvas's available width is below 1660px
- **THEN** grid cells and bookmark icons render at 80px

#### Scenario: Middle tier from 1660px up to 2100px
- **WHEN** the canvas's available width is at least 1660px and below 2100px
- **THEN** grid cells and bookmark icons render at 106px

#### Scenario: Largest tier at 2100px and wider
- **WHEN** the canvas's available width is at least 2100px
- **THEN** grid cells and bookmark icons render at 166px

#### Scenario: Capacity derived by floor division
- **WHEN** the grid's current tier icon size and the canvas's available width and height are known
- **THEN** the number of columns is the available width divided by the tier icon size rounded down, and the number of rows is the available height divided by the tier icon size rounded down

#### Scenario: Leftover space is not used to stretch icons
- **WHEN** the available width or height does not divide evenly by the tier icon size
- **THEN** the remaining space is left unused rather than growing icon size beyond the tier value

## ADDED Requirements

### Requirement: Canvas Hides Native Scroll Controls
The system SHALL hide the canvas's native horizontal and vertical scrollbar controls while keeping the canvas scrollable by other input methods (e.g. wheel, trackpad, keyboard).

#### Scenario: No visible scrollbar when content briefly exceeds the container
- **WHEN** the canvas grid's rendered content exceeds the container's visible area
- **THEN** no native vertical or horizontal scrollbar track or thumb is rendered, but the content can still be scrolled with the wheel or trackpad
