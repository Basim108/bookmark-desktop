## Why

`2026-07-19-prepare-store-submission` cleared the two hard blockers (privacy
policy, screenshots) and left the submission ready except for items that only
surface once you are actually filling in the Developer Dashboard form. Four
remain:

1. The dashboard offers a **Marquee promo tile** slot (1400×560). The repo has
   the 1280×800 screenshot and the 440×280 small tile, but not this one.
2. Setting the listing's **Official URL** requires the site behind it to be
   verified in Google Search Console, which needs a verification file served
   from the published site. Google has issued
   `googlee985901f62e6bb4d.html`; it currently sits at the repository root,
   where the Pages build never sees it.
3. The published site (`https://basim108.github.io/bookmark-desktop/`) exists
   only to host the privacy policy. Its index page lists two links and shows no
   favicon — thin for a page the store listing will point at as the project's
   official home.
4. There is no route for a user to file a usable bug report. `.github/` carries
   only `dependabot.yml`, so every issue arrives unstructured.

A dedicated support page was considered and **deliberately dropped** — the index
page linking to GitHub Issues covers the same ground without a second page to
maintain. The listing's Support URL will point straight at the issues tracker.

## What Changes

**Marquee promo tile**

- Add a 1400×560 capture to `store-assets/capture.spec.ts` alongside the two
  existing sizes. Format is already satisfied: Chromium emits PNG colortype 2
  (24-bit RGB, no alpha) for fully opaque pages, which both committed assets
  confirm — so no JPEG conversion and no image-processing dependency.
- The tile uses a **real-UI split layout**: wordmark and tagline on the left,
  the actual seeded bookmark desktop bleeding off the right edge. At 2.5:1 the
  centered icon-over-title composition used for the 440×280 tile leaves the
  frame mostly empty, and the marquee is what appears in the store's featured
  carousel — it should show the product.

**Google site verification**

- Move `googlee985901f62e6bb4d.html` from the repository root into `site/`, so
  the Pages build serves it at
  `https://basim108.github.io/bookmark-desktop/googlee985901f62e6bb4d.html`.
  It carries no YAML front matter, so Jekyll copies it verbatim; the existing
  `site/**` path filter already triggers a redeploy.
- Record why the file exists and that it must never be deleted — Google
  re-checks periodically and silently un-verifies on a 404.

**Project site polish**

- Add a GitHub Issues link to `site/index.md`'s link list with a one-line
  explanation of what to use it for, and give the existing two links matching
  descriptors so the list reads evenly.
- Give the site a favicon built from the extension's own `icon-32.png`. The
  icon is **copied into the build by the workflow** rather than duplicated into
  `site/`, matching the rule the Pages build already follows for `PRIVACY.md`:
  published files are assembled from their source of truth, never from a copy
  that can drift. This adds `public/icons/**` to the workflow's path filter.

**Issue templates**

- Add a bug-report template that collects the context a maintainer cannot
  reconstruct after the fact (extension version, Chrome version, OS, steps,
  expected vs. actual), and a feature-request template.

## Capabilities

### New Capabilities

- `issue-intake`: how users report bugs and request features, and what context a
  report must carry to be actionable. This is its own capability rather than
  part of `extension-branding` because it governs inbound user feedback, not the
  extension's public identity.

### Modified Capabilities

- `extension-branding`: *Store Listing Visual Assets* extends to require the
  1400×560 marquee tile and to constrain its composition; new requirements
  cover the published project site's identity (favicon, link list) and the
  search-engine verification file it must serve.

## Impact

**Store assets**

- `store-assets/capture.spec.ts` — third capture test; the split layout needs
  the seeded desktop rendered into the composition rather than captured
  standalone, so it likely shares `seedDesktop`/`warmFaviconCache` with the
  1280×800 test rather than re-seeding.
- `store-assets/marquee-1400x560.png` — new committed asset.
- `store-assets/README.md` — document the third asset and its regeneration.

**Site**

- `site/googlee985901f62e6bb4d.html` — moved from the repository root.
- `site/index.md` — issues link plus descriptors.
- `site/_layouts/default.html` **or** `site/_includes/head-custom.html` — the
  favicon `<link>`. Which one depends on whether `jekyll-theme-minimal` exposes
  a `head-custom.html` hook; it is a remote gem, not resolvable locally, so
  this is settled by trying the include first and falling back to a layout
  override only if the favicon does not appear. The override works but carries
  a copy of theme markup that will not pick up upstream fixes, so it is the
  second choice.
- `.github/workflows/pages.yml` — copy `public/icons/icon-32.png` into the
  build; add `public/icons/**` to the push path filter so a changed icon
  redeploys.
- The favicon href must resolve through `relative_url`: the site is served
  under `baseurl: /bookmark-desktop`, and the browser's automatic
  `/favicon.ico` probe hits the *host* root, which a project page does not
  control — so an explicit `<link rel="icon">` is mandatory.

**Repository**

- `.github/ISSUE_TEMPLATE/bug_report.yml`, `feature_request.yml`, and
  `config.yml`.

**Tests**

- None. The capture script asserts nothing by design
  (`playwright.store-assets.config.ts`), and the site and templates are not
  executable code. Verification is by inspection of the generated asset's
  dimensions and colortype, and of the deployed site.

**Process (not code)**

- Verify the site in Google Search Console after the deploy, then set the
  listing's Official URL.
- **Known risk:** Google's HTML-file method verifies a URL-prefix property
  scoped to where the file sits, so this verifies
  `https://basim108.github.io/bookmark-desktop/` and *not* the bare
  `https://basim108.github.io/`. Whether the Official URL field accepts a
  path-scoped property is unconfirmed. If it demands the bare host, the
  fallback is a one-file `basim108.github.io` user-site repository serving the
  same verification file at its root. The first step is identical either way,
  so this does not block starting.
- Set the listing's Support URL to
  `https://github.com/Basim108/bookmark-desktop/issues`.

## Non-goals

- **No support page.** Dropped deliberately; the index page's issues link
  covers it.
- **No in-extension feedback link and no `chrome.runtime.setUninstallURL()`
  survey.** Both are worth doing and both are changes to the extension itself
  rather than to submission collateral — they belong in a follow-up change,
  after the extension is live and there are real users to hear from.
- **No publish automation.** Automating releases through the Chrome Web Store
  API is a separate change, and it is blocked until the first manual submission
  produces an item ID.
