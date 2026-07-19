# Chrome Web Store submission — dashboard answers

Paste-ready answers for the fields the Developer Dashboard asks for at
submission time. Listing copy itself lives in `store-listing.md`; this file
covers everything else. Keep both in sync when behavior changes.

## Privacy policy URL

```
https://basim108.github.io/bookmark-desktop/privacy/
```

Served by GitHub Pages from the repository's own `PRIVACY.md` — the page is
assembled from that file at deploy time (`.github/workflows/pages.yml`), so the
published policy can never drift from the one in the repo. Editing `PRIVACY.md`
on `main` republishes it.

## Official URL and site verification

```
https://basim108.github.io/bookmark-desktop/
```

The dashboard only offers this field for a site verified in Google Search
Console under the same Google account that owns the developer account.
Verification is by hosted file: `site/googlee985901f62e6bb4d.html`, served at

```
https://basim108.github.io/bookmark-desktop/googlee985901f62e6bb4d.html
```

**That file must never be deleted, renamed, or reformatted.** Google re-checks
it periodically and silently revokes verification when it stops resolving or
its contents change. `.prettierignore` excludes it for that reason.

Caveat worth knowing before you start: Google's hosted-file method verifies a
**URL-prefix property scoped to the path the file sits at**. This verifies
`https://basim108.github.io/bookmark-desktop/`, not the bare
`https://basim108.github.io/`. Whether the Official URL field accepts a
path-scoped property is unconfirmed. If it insists on the bare host, the
fallback is a `basim108.github.io` user-site repository serving the same file
at its root. Record which one worked here once you know.

## Support URL

```
https://github.com/Basim108/bookmark-desktop/issues
```

Matches `package.json`'s `bugs.url`. The published site's index page links to
the same tracker, and the repository carries issue templates
(`.github/ISSUE_TEMPLATE/`) so reports arrive with the version, browser, and
reproduction context a maintainer cannot reconstruct after the fact.

## Data-use disclosures

The extension collects nothing and transfers nothing, so every category is
answered "no".

| Question                                                    | Answer |
| ----------------------------------------------------------- | ------ |
| Does this item collect personally identifiable information? | No     |
| Health information?                                         | No     |
| Financial and payment information?                          | No     |
| Authentication information?                                 | No     |
| Personal communications?                                    | No     |
| Location?                                                   | No     |
| Web history?                                                | No     |
| User activity (clicks, mouse position, scroll, keystrokes)? | No     |
| Website content (text, images, sound, files)?               | No     |

Then affirm all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved
  use cases.
- I do not use or transfer user data for purposes unrelated to my item's single
  purpose.
- I do not use or transfer user data to determine creditworthiness or for
  lending purposes.

All three are true: no data leaves the device.

## Single purpose

> Bookmark Desktop replaces Chrome's new-tab page with a customizable desktop of
> the user's existing bookmarks — a grid of icons with a folder sidebar.

Every permission below serves that one purpose.

## Permission justifications

**`bookmarks`**

> The extension's entire purpose is to display the user's bookmarks as an icon
> desktop, so it reads the bookmark tree to render it, and writes to it when the
> user adds, renames, moves, or deletes a bookmark from within the extension.

**`storage`**

> Stores the user's icon layout (which page, row, and column each bookmark
> occupies), their display settings, and any custom icons or background image
> they upload — all locally on the device.

**`favicon`**

> Displays each bookmark's site icon on the desktop grid, using Chrome's own
> favicon service rather than contacting sites directly.

No host permissions are requested, so the extension cannot read the content of
any web page.

## Expected install warnings

Chrome will show these at install; the listing copy already explains both, which
helps review go smoothly:

- "Replace the page you see when opening a new tab" — this is the extension's
  stated purpose, covered in the listing's opening line.
- "Read and change your bookmarks" — covered by the listing's privacy paragraph
  and the `bookmarks` justification above.

## Assets and package

- Screenshot (1280×800) and promo tile (440×280): `store-assets/` — regenerate
  with `npm run build && npm run assets:store`.
- Upload `dist/` as a zip, or a packed `.crx`. Follow `SECURITY.md` for signing
  key handling: move the `.pem` to a vault immediately after packing, and never
  commit it.

## How the privacy policy is hosted

Settled: GitHub Pages, built by `.github/workflows/pages.yml`. The alternative
was linking the rendered markdown at
`https://github.com/Basim108/bookmark-desktop/blob/main/PRIVACY.md` — zero setup
and acceptable to reviewers, but the URL is branch-coupled and reads worse on a
store listing.

Notes on the setup:

- Pages uses **Source: GitHub Actions**, not "Deploy from a branch". The branch
  option only serves the repo root or `/docs`, and `/docs` would have published
  this file — internal submission notes — alongside the policy. The workflow
  publishes the policy page and nothing else.
- No manual settings change is needed: the workflow enables Pages itself on its
  first run (`configure-pages` with `enablement: true`).
- The site is rebuilt on any push to `main` that touches `PRIVACY.md`,
  `site/**`, or the workflow itself, and can be run on demand from the Actions
  tab (`workflow_dispatch`).
- To change the policy, edit `PRIVACY.md` and merge to `main`. Don't edit a
  copy under `site/` — there isn't one, by design.
