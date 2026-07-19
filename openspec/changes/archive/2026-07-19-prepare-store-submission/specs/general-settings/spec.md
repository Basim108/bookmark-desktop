## MODIFIED Requirements

### Requirement: General Settings Window
The system SHALL provide a global "Settings" window, opened from the sidebar's header hamburger button, presented as a centered modal window matching the Edit Bookmark and Folder Settings windows' style — a titlebar containing the title "Settings" and a close (✕) control in the top-right corner, an opaque body, and a footer containing a Save button. The window SHALL float over the center of the viewport (portaled to the document body) and SHALL NOT be tied to any single folder or bookmark. Closing the window via the close control, pressing the Escape key, or clicking the backdrop SHALL discard any unsaved edits. Only one General Settings window SHALL be open at a time.

While a transfer operation the window started is still running, the window SHALL NOT be dismissable — neither by the Escape key, the close control, nor the backdrop. Dismissing it mid-operation would unmount the window while the operation continued in the background, so the user would receive the operation's downloads with no window to explain them and never see its completion summary or the reload prompt that follows it. Dismissal SHALL become available again on any finish path that leaves the window standing — a denial, a cancellation, or a failure. A successful import does not return to that state by design: a clean import reloads the page, and a partial one holds its summary open until acknowledged.

#### Scenario: Opening the window from the header button
- **WHEN** the user clicks the sidebar header's hamburger button
- **THEN** a centered modal window titled "Settings" opens over the viewport

#### Scenario: Window matches the other settings windows' style
- **WHEN** the General Settings window is open
- **THEN** it displays a titlebar with the title "Settings" and a close (✕) control in the top-right corner, an opaque body, and a footer with a Save button

#### Scenario: Close control discards unsaved edits
- **WHEN** the window has unsaved edits and the user clicks the close (✕) control
- **THEN** the window closes and none of the staged edits are applied

#### Scenario: Escape discards unsaved edits
- **WHEN** the window has unsaved edits and the user presses the Escape key
- **THEN** the window closes and none of the staged edits are applied

#### Scenario: Backdrop click discards unsaved edits
- **WHEN** the window has unsaved edits and the user clicks the backdrop outside the window
- **THEN** the window closes and none of the staged edits are applied

#### Scenario: Escape cannot dismiss the window during a running import
- **WHEN** an import is running and the user presses the Escape key
- **THEN** the window stays open, the import continues, and the user still receives its completion summary and reload prompt

#### Scenario: The window cannot be dismissed by any control during a running import
- **WHEN** an import is running and the user clicks the close (✕) control or the backdrop
- **THEN** the window stays open until the operation finishes

#### Scenario: Dismissal is available again once the operation finishes
- **WHEN** a running import finishes on a path that leaves the window standing (denied, cancelled, or failed)
- **THEN** the Escape key, close control, and backdrop dismiss the window normally again
