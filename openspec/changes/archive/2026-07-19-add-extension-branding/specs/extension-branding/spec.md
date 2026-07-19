## ADDED Requirements

### Requirement: Single SVG Master Logo
The extension SHALL have a single vector SVG file as the source of truth for its
logo, from which all raster icon sizes are generated. The mark SHALL use the
launchpad-grid identity — a grid of rounded tiles with one tile in the product
accent color `#1a73e8` on a neutral tile background — reflecting the product (a
desktop of bookmark icons). Hand-editing individual PNG sizes SHALL NOT be the
maintenance path; the PNGs SHALL be reproducible from the SVG.

#### Scenario: One vector source exists
- **WHEN** the repository is inspected
- **THEN** a single SVG master logo file exists and is the source the raster icons are generated from

#### Scenario: The mark uses the product identity
- **WHEN** the logo is rendered
- **THEN** it shows a grid of rounded tiles with one accent tile in `#1a73e8` on a neutral background

### Requirement: Chrome Icon Sizes Wired Into the Manifest
The extension SHALL provide PNG icons at 16, 32, 48, and 128 px, generated from
the SVG master, and the manifest SHALL reference all four sizes in its `icons`
map. Each referenced icon file SHALL exist and be a non-blank rendering of the
logo (not the previous empty placeholder).

#### Scenario: All required sizes are present and referenced
- **WHEN** the built extension's manifest is read
- **THEN** its `icons` map references 16, 32, 48, and 128 px PNGs, and each referenced file exists

#### Scenario: Icons are the logo, not blank placeholders
- **WHEN** the icon PNGs are inspected
- **THEN** each renders the launchpad-grid logo rather than an empty/blank square

### Requirement: New-Tab Page Shows the Logo as Its Favicon
The extension's new-tab page SHALL declare the logo as its favicon, so the
browser tab for the extension's own page shows the mark rather than a blank or
default favicon.

#### Scenario: New-tab page declares a logo favicon
- **WHEN** the new-tab page document is loaded
- **THEN** it declares an icon link resolving to the extension's logo

### Requirement: Icons Are Reproducible From the SVG
The project SHALL provide a documented, repeatable way to regenerate the PNG icon
sizes from the SVG master (a script), so the icons can be updated by editing the
SVG and re-running generation. Regenerating SHALL produce the committed PNG sizes.

#### Scenario: Regeneration reproduces the icon set
- **WHEN** the icon-generation step is run against the SVG master
- **THEN** it outputs the 16/32/48/128 px PNGs used by the manifest

### Requirement: Manifest Short Description
The extension SHALL have a short description that accurately and appealingly
summarizes what it does, written for users, and within the Chrome-imposed
132-character limit for the manifest `description`. The description SHALL be the
source the manifest reads (the project derives the manifest description from the
package metadata), SHALL be free of grammatical errors, and SHALL lead with the
user benefit rather than internal phrasing.

#### Scenario: Short description is accurate and within the limit
- **WHEN** the manifest description is read
- **THEN** it is a clear, benefit-led, grammatically correct summary of the extension that is 132 characters or fewer

### Requirement: Store Listing Description
The repository SHALL contain a maintained document holding the extension's Chrome
Web Store listing description — comprehensive yet concise copy written for
prospective users. It SHALL include a one-line hook, a short introduction, a
scannable list of the key features, a brief "how it works" explanation, and a
privacy/data note (that bookmark data stays in the browser and nothing is
transmitted off-device beyond the declared favicon fetches). It SHALL be the
repo's source of truth for the copy the publisher enters into the Web Store
dashboard.

#### Scenario: Store listing copy exists and is complete
- **WHEN** the store-listing document is read
- **THEN** it contains a hook, an introduction, a key-feature list, a how-it-works explanation, and a privacy/data note, written for prospective users

#### Scenario: Listing copy matches the extension's actual capabilities
- **WHEN** the store-listing copy is compared to the extension's behavior
- **THEN** every feature it claims is one the extension actually provides (no aspirational or unimplemented claims)
