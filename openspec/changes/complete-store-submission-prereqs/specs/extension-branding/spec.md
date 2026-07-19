## MODIFIED Requirements

### Requirement: Store Listing Visual Assets

The repository SHALL carry the visual assets the Chrome Web Store requires to
submit the item: at least one screenshot at 1280×800 showing the extension's
actual new-tab desktop, a 440×280 small promo tile, and a 1400×560 marquee promo
tile. The screenshots SHALL depict real rendered extension UI with representative
bookmark content — not mockups, and not an empty or unconfigured state.

Every committed asset SHALL be free of an alpha channel, as the store accepts
only JPEG or 24-bit PNG. Capturing a fully opaque page satisfies this without a
conversion step; an asset whose composition leaves a transparent region SHALL be
treated as a defect.

The marquee tile SHALL use a composition suited to its 2.5:1 aspect ratio,
showing the extension's real rendered desktop rather than a centered logo
lockup, because it is the asset the store's featured placements display. It
SHALL remain visually consistent with the small promo tile so the two read as
one family.

The screenshots SHALL be reproducible rather than hand-captured: the repository
SHALL provide a script that drives the built extension in real Chromium and
writes the assets at the required dimensions, so they can be regenerated after a
UI change without manual re-cropping.

#### Scenario: Required screenshot dimensions are present
- **WHEN** the store assets are inspected before submission
- **THEN** at least one screenshot is present at exactly 1280×800, alongside a 440×280 promo tile and a 1400×560 marquee tile

#### Scenario: Assets carry no alpha channel
- **WHEN** a committed store asset is inspected
- **THEN** it is a JPEG or a 24-bit PNG with no alpha channel

#### Scenario: Screenshots show real extension UI
- **WHEN** a store screenshot is viewed
- **THEN** it shows the extension's actual rendered new-tab desktop with representative bookmark content, not a mockup or an empty state

#### Scenario: The marquee tile suits its aspect ratio
- **WHEN** the marquee tile is viewed
- **THEN** it shows the extension's real rendered desktop composed for a wide frame, rather than a centered logo lockup surrounded by empty space

#### Scenario: Screenshots can be regenerated from a script
- **WHEN** the capture script is run against the built extension
- **THEN** it loads the real extension in Chromium and writes every store asset at its required dimensions without manual cropping

## ADDED Requirements

### Requirement: Published Project Site Carries the Extension's Identity

The project's published site SHALL present itself as the extension's public
home, not merely as a container for the privacy policy. It SHALL declare a
favicon rendering the extension's logo, so a browser tab showing the site
carries the same mark as the installed extension.

The favicon SHALL be assembled from the extension's own committed icon at
deploy time rather than from a copy kept alongside the site sources, so the
site's mark and the shipped extension's mark cannot diverge. This follows the
rule the site build already applies to the privacy policy.

The site SHALL link to the project's issue tracker, alongside the privacy policy
and the source repository, with a brief explanation of what each link is for.

#### Scenario: The site declares a logo favicon
- **WHEN** any page of the published site is loaded
- **THEN** the document declares an icon link that resolves successfully to the extension's logo

#### Scenario: The favicon is not a committed duplicate
- **WHEN** the site sources are inspected
- **THEN** no copy of the icon is stored among them; the published icon is assembled from the extension's own icon set at deploy time

#### Scenario: Site links resolve under the published base path
- **WHEN** a link or asset reference on the published site is followed
- **THEN** it resolves correctly under the site's base path rather than against the host root

#### Scenario: Users can find where to report problems
- **WHEN** a visitor reads the site's index page
- **THEN** it links to the issue tracker with a brief explanation of what to use it for, alongside similarly described links to the privacy policy and the source repository

### Requirement: Published Site Serves Its Ownership Verification

The published site SHALL serve the ownership-verification file that the search
provider issued for it, at the exact path the provider expects and with its
contents unaltered, whenever the store listing names that site as the
extension's official URL.

The verification file SHALL be served indefinitely: providers re-check
periodically and revoke verification when the file stops resolving. The
repository SHALL record what the file is and that it must not be deleted or
renamed, so it is not mistaken for a stray artifact during later cleanup.

#### Scenario: The verification file is served verbatim
- **WHEN** the verification URL is requested from the published site
- **THEN** it returns the provider-issued file with its contents unaltered, rather than a rendered page or a 404

#### Scenario: The file's purpose is recorded
- **WHEN** the repository is inspected for why the verification file exists
- **THEN** documentation states what it verifies and that deleting or renaming it revokes the site's verification
