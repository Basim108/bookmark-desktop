## 1. Marquee promo tile (1400×560)

- [x] 1.1 Add a `MARQUEE = { width: 1400, height: 560 }` size constant to `store-assets/capture.spec.ts` alongside `SCREENSHOT` and `PROMO_TILE`
- [x] 1.2 Add a third capture test that seeds the desktop and warms the favicon cache via the existing `seedDesktop`/`warmFaviconCache` helpers, so the tile shows populated real UI rather than an empty grid
- [x] 1.3 Compose the split layout: wordmark and tagline on the left, the seeded desktop bleeding off the right edge — reuse the wordmark type treatment from the 440×280 tile so the two assets read as one family
- [x] 1.4 Capture at a 1400×560 viewport so the dimensions come out of the run directly, with no post-crop
- [x] 1.5 Verify the written PNG is 1400×560 and **colortype 2** (24-bit RGB, no alpha) — the store rejects alpha; Chromium already emits colortype 2 for fully opaque pages, so a transparent gap in the composition is the only way this regresses
- [x] 1.6 Commit `store-assets/marquee-1400x560.png` and document it plus its regeneration command in `store-assets/README.md`

## 2. Google site verification

- [x] 2.1 Move `googlee985901f62e6bb4d.html` from the repository root to `site/`
- [x] 2.2 Confirm it has no YAML front matter, so Jekyll copies it byte-for-byte rather than rendering it
- [x] 2.3 Add a note — in `site/_config.yml` and in `docs/store-submission.md` — recording what the file is for and that it must never be deleted or renamed, since Google re-checks periodically and silently un-verifies on a 404
- [x] 2.4 Confirm no workflow change is needed: the existing `site/**` path filter in `pages.yml` already covers it
- [ ] 2.5 After deploy, fetch `https://basim108.github.io/bookmark-desktop/googlee985901f62e6bb4d.html` and confirm it returns the verification string verbatim

## 3. Site favicon

- [ ] 3.1 Determine whether `jekyll-theme-minimal` honors a `_includes/head-custom.html` hook. **Only observable after a deploy** — the theme is a remote gem, not resolvable locally, and a theme that lacks the hook ignores the override silently rather than failing the build. Settled by 3.6: favicon present means the hook works
- [x] 3.2 Added `site/_includes/head-custom.html` (the hook branch). If 3.6 shows no favicon, fall back to copying the theme's `default.html` into `site/_layouts/`, noting in a comment that the copy will not track upstream theme fixes
- [x] 3.3 Add a step to `pages.yml`'s assemble job copying `public/icons/icon-32.png` into the build — do NOT commit a duplicate under `site/`; the build assembles from sources of truth so the site favicon and the shipped extension icon cannot diverge
- [x] 3.4 Add `public/icons/**` to the `pages.yml` push path filter so a regenerated icon triggers a redeploy
- [x] 3.5 Write the href through `relative_url` — the site is served under `baseurl: /bookmark-desktop`, so a bare `/icon-32.png` resolves against the host root and 404s
- [ ] 3.6 After deploy, confirm the favicon appears on **both** the index page and `/privacy/`, and that its URL returns 200 rather than the Pages 404 page

## 4. Issues link on the site index

- [x] 4.1 Add a GitHub Issues link to the list in `site/index.md` with a one-line explanation of what to use it for (bug reports and feature requests)
- [x] 4.2 Give the existing "Privacy policy" and "Source code on GitHub" entries matching one-line descriptors so the list reads evenly
- [x] 4.3 Confirm the issues URL matches `package.json`'s `bugs.url`

## 5. Issue templates

- [x] 5.1 Add `.github/ISSUE_TEMPLATE/bug_report.yml` collecting extension version, Chrome version, OS, steps to reproduce, and expected vs. actual — the context a maintainer cannot reconstruct after the fact
- [x] 5.2 Add `.github/ISSUE_TEMPLATE/feature_request.yml` asking what the user is trying to accomplish, not just what to build
- [x] 5.3 Add `.github/ISSUE_TEMPLATE/config.yml` linking to the privacy policy and the store listing for questions that are not bugs
- [ ] 5.4 Open the "New issue" page on the repository and confirm both templates render and that no required field is one a non-technical user cannot answer

## 6. Verification

- [x] 6.1 Run `npm run build && npm run assets:store` and confirm all three assets regenerate at their exact required dimensions
- [x] 6.2 Run `npm run format` — the workflow, YAML, and markdown edits are all Prettier-covered
- [ ] 6.3 Confirm the Pages deploy succeeds and the site still serves `/privacy/` unchanged
- [x] 6.4 Confirm no change touches `src/**`, so the extension build and the CI suite are unaffected

## 7. Dashboard follow-up (process, not code)

- [ ] 7.1 Verify the site in Google Search Console using the deployed HTML file
- [ ] 7.2 Set the listing's Official URL. **If the field will not accept the path-scoped property** `https://basim108.github.io/bookmark-desktop/`, create a `basim108.github.io` user-site repository serving the same verification file at its root and verify the bare host instead
- [ ] 7.3 Set the listing's Support URL to `https://github.com/Basim108/bookmark-desktop/issues`
- [ ] 7.4 Upload the marquee tile alongside the existing screenshot and small promo tile
- [ ] 7.5 Record the outcome of 7.2 in `docs/store-submission.md` — which property granularity the Official URL field actually accepted — so the next person does not have to rediscover it
