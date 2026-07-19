## ADDED Requirements

### Requirement: Published Privacy Policy
The repository SHALL contain a privacy policy document, distinct from the store
listing copy, written as a policy a Chrome Web Store reviewer or a user can be
linked to directly. It SHALL state what data the extension handles (the user's
bookmarks, layout positions, settings, and uploaded images), that all of it stays
on the user's device in browser-local storage, that none of it is transmitted
off-device, and that the only outbound requests are the favicon fetches made
through the MV3 `_favicon` API. It SHALL carry a last-updated date and a contact
route for privacy questions.

The policy SHALL be reachable at a stable public URL suitable for the Developer
Dashboard's privacy policy field, and the claims it makes SHALL match the
extension's actual behavior and its declared permissions.

#### Scenario: Privacy policy exists as its own document
- **WHEN** the repository is inspected for a privacy policy
- **THEN** a dedicated policy document is present, separate from the store-listing copy, carrying a last-updated date and a contact route

#### Scenario: Policy states the no-transmission posture
- **WHEN** the privacy policy is read
- **THEN** it states that all handled data stays in browser-local storage on the user's device, that nothing is transmitted off-device, and that the only outbound requests are the declared favicon fetches

#### Scenario: Policy is linkable from the dashboard
- **WHEN** the publisher fills in the Developer Dashboard's privacy policy URL
- **THEN** the URL resolves to the published policy and remains stable across releases

#### Scenario: Policy claims match actual behavior
- **WHEN** the policy's claims are compared against the manifest's permissions and the extension's network behavior
- **THEN** every claim holds, with no data collection or transfer beyond what the policy describes

### Requirement: Store Listing Visual Assets
The repository SHALL carry the visual assets the Chrome Web Store requires to
submit the item: at least one screenshot at 1280×800 showing the extension's
actual new-tab desktop, and a 440×280 small promo tile. The screenshots SHALL
depict real rendered extension UI with representative bookmark content — not
mockups, and not an empty or unconfigured state.

The screenshots SHALL be reproducible rather than hand-captured: the repository
SHALL provide a script that drives the built extension in real Chromium and
writes the assets at the required dimensions, so they can be regenerated after a
UI change without manual re-cropping.

#### Scenario: Required screenshot dimensions are present
- **WHEN** the store assets are inspected before submission
- **THEN** at least one screenshot is present at exactly 1280×800, alongside a 440×280 promo tile

#### Scenario: Screenshots show real extension UI
- **WHEN** a store screenshot is viewed
- **THEN** it shows the extension's actual rendered new-tab desktop with representative bookmark content, not a mockup or an empty state

#### Scenario: Screenshots can be regenerated from a script
- **WHEN** the capture script is run against the built extension
- **THEN** it loads the real extension in Chromium and writes the screenshot assets at the required dimensions without manual cropping

### Requirement: Manifest Links Back to the Project Home
The manifest SHALL declare a `homepage_url` pointing at the project's public home,
so the extension's entry in `chrome://extensions` and its store listing link back
to the project. The URL SHALL resolve — repository metadata that names the
project SHALL point at the actual repository rather than a former or renamed one.

#### Scenario: Manifest declares a homepage
- **WHEN** the built manifest is read
- **THEN** it contains a `homepage_url` pointing at the project's public home

#### Scenario: Project metadata URLs resolve
- **WHEN** the repository, homepage, and issue URLs recorded in the project metadata are followed
- **THEN** each resolves to the actual project rather than returning a 404
