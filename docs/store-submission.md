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

Note on granularity, now settled: Google's hosted-file method verifies a
**URL-prefix property scoped to the path the file sits at** —
`https://basim108.github.io/bookmark-desktop/`, not the bare
`https://basim108.github.io/`. **The Official URL field accepted this
path-scoped property directly.** No `basim108.github.io` user-site repository
was needed, so there is no extra root-served copy of the verification file to
keep alive — the single copy under `site/` is the whole story.

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
- The store package is a **plain zip of `dist/`**, and **no signing key is
  involved**: Google signs the published item itself. Releases are automated
  (see below), so this is normally not done by hand at all.
- The `.crx` and `.pem` guidance in `SECURITY.md` is for **self-distribution**
  — hosting the extension outside the store — and does not apply to a store
  submission. Don't go looking for somewhere to put a signing key in the
  release workflow; there isn't one, by design.

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

## Releasing a new version

Publishing a GitHub release is the only thing that ships a version.
`.github/workflows/release.yml` does the rest: it builds the tagged commit,
zips `dist/`, uploads it to the store item, and submits it for review.

### The one-time setup that everything else depends on

**Publish the OAuth consent screen before generating the refresh token.**

This is the single most common way Chrome Web Store automation dies, and it
fails months later in a way that looks like anything but its actual cause.

If the Google Cloud project's OAuth consent screen is in **Testing** status,
Google expires refresh tokens after **seven days**. The first release works.
A release a week later fails with:

```
invalid_grant
```

— with nothing to suggest that the credential, rather than the workflow, is at
fault. Searching for `invalid_grant` is how a future maintainer is most likely
to arrive at this paragraph, which is why the string is written out here.

Publishing the consent screen **after** the token was minted does not rescue
it. A token generated under Testing status stays short-lived; it has to be
regenerated once the screen is Published (or Internal, for a Workspace
organization).

So, in this order:

1. Set the consent screen to **Published** or **Internal**.
2. _Then_ generate the refresh token.
3. Add the four repository secrets below.

No workflow step can check this in advance — a seven-day-old token is
indistinguishable from a permanent one until it expires — so this note is the
only available safeguard.

### Repository secrets

| Secret                 | What it is                                                    |
| ---------------------- | ------------------------------------------------------------- |
| `CHROME_CLIENT_ID`     | OAuth client id from the Google Cloud project                 |
| `CHROME_CLIENT_SECRET` | OAuth client secret                                           |
| `CHROME_REFRESH_TOKEN` | Long-lived refresh token — generate it _after_ the step above |
| `CHROME_EXTENSION_ID`  | The item's id from the Developer Dashboard URL                |

No signing key. See "Assets and package" above.

### Cutting a release

1. Open a bump pull request: the new version in `package.json`, and its entry
   in `CHANGELOG.md` written for users. If any commit since the last tag
   records a breaking change, CI requires that entry to carry a heads-up line
   (`scripts/check-breaking-change.ts`) — it is far cheaper to add one here
   than after a version number has been spent.
2. Merge it, and let CI go green on `main`.
3. Tag the merge commit `v<version>` — for example `v1.2.0` — and push the tag.
4. Publish a GitHub release for that tag. Its body is generated for
   contributors from the commit history (`.github/release.yml`); the
   user-facing account is `CHANGELOG.md` and the two are deliberately separate.
5. Watch the workflow through to "Submitted for review".

### What can refuse a release

Every one of these runs _before_ anything is uploaded, so a refused release
costs a workflow run and nothing else:

- The tag is not a version tag, or names a different version than
  `package.json`. The leading `v` is stripped before comparing.
- The tagged commit's checks did not all succeed.
- The tagged commit has **no** checks at all. Absence of checks is treated as
  failure, not success — an unverified commit is not releasable. (CI's path
  filters include `package.json`, `package-lock.json`, and `CHANGELOG.md` so
  that a bump commit does produce checks; without them it would match no path
  and produce none.)
- `CHANGELOG.md` has no readable entry for the version being built, which fails
  the build itself — a release cannot ship a "What's new" window that opens
  empty.

### Submitted is not published

The API returns success when the package is **handed over**. Review is
asynchronous, usually takes hours to days, and can reject. A green workflow
means "submitted", which is what the job summary says. Watch the Developer
Dashboard for the outcome; the workflow also polls for a few minutes and
reports what it sees, but never fails a genuine submission over it.

### If a run fails between upload and publish

The store will not accept a re-upload of a version it already has, so
re-running the workflow will fail with a 400. The already-uploaded draft is
sitting in the Developer Dashboard — **publish it from there** rather than
trying to make the workflow do it again. Only if the draft itself is wrong does
the version number need to be burned and a new one cut.
