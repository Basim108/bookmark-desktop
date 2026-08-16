## Why

Publishing a new version is entirely manual today: bump `package.json`, build,
zip `dist/`, and upload through the Developer Dashboard by hand. Nothing ties a
git tag, a GitHub release, and a store submission together, so the three can
disagree and only a human notices.

The cost is already visible. `1.0.0` shipped on 2026-08-02; `main` has taken 61
non-merge commits since — nine features and eleven fixes among them — and
`package.json` still reads `1.0.0`. Work that is merged, green, and finished is
not reaching users, because reaching users is a chore somebody has to remember
to do.

A release should be one deliberate act — publish a GitHub release — with
everything downstream derived from it.

> **Blocked on an external prerequisite.** This change MUST NOT be implemented
> until the Google Cloud OAuth consent screen backing the publishing credentials
> is confirmed to be **Published** (or **Internal**). While it sits in
> **Testing**, Google expires refresh tokens after seven days: the first release
> succeeds and every later one fails with an opaque `invalid_grant`. This is a
> console action no workflow can perform or detect in advance. See
> `design.md` → "Prerequisite: OAuth consent screen".

## What Changes

- Publishing a GitHub release triggers a workflow that builds the extension from
  the tagged commit, packages `dist/` as a zip, uploads it to the Chrome Web
  Store, and submits it for review.
- The release is refused unless the tag and `package.json` agree. Tags are
  `v`-prefixed (`v1.1.0`); the leading `v` is stripped before comparison, so the
  manifest version and the tag can never silently diverge.
- The release is refused unless the tagged commit already has a **successful**
  CI run. The release job runs no tests of its own — it gates on the result of
  the CI that already ran. Absence of checks counts as failure, not as success.
- `ci.yml`'s path filters gain the files a release-bump commit touches
  (`package.json`, `package-lock.json`, `CHANGELOG.md`), which today match no
  filter and therefore produce no checks at all for the gate to read.
- The GitHub release body is generated from git history and addressed to
  **contributors**: the full commit list, dependency bumps included, with author
  and PR attribution. `.github/release.yml` configures the categories.
- CI refuses a release whose `CHANGELOG.md` entry omits a heads-up line when any
  commit since the previous tag carries a `BREAKING CHANGE` footer or a `!`
  marker — so a user-visible disruption cannot ship unannounced.
- The workflow reports what it actually achieved: submission is not publication.
  Chrome Web Store review is asynchronous and can reject. Polling the item's
  review state and surfacing the outcome is included, marked optional.
- `docs/store-submission.md` records the automated path, the credentials it
  needs, the consent-screen requirement above, and the fact that store uploads
  are plain zips — no `.pem`, no signing key, contrary to what the current
  "Assets and package" section implies.

## Capabilities

### New Capabilities

- `release-publishing`: how a version reaches users. Covers the single trigger
  (a published GitHub release), the tag/manifest agreement rule, the green-CI
  precondition, what gets packaged, the submission to the Chrome Web Store, the
  contributor-facing release body, the breaking-change announcement guard, and
  the recorded operational prerequisites for the publishing credentials.

### Modified Capabilities

<!-- None. No user-facing extension behavior changes; this change adds no code
     under src/ and alters no requirement in an existing spec. -->

## Impact

- `.github/workflows/release.yml` (new) — triggered by `release: published`.
  Asserts tag/version agreement, gates on the tagged commit's checks, builds,
  zips, uploads, publishes, optionally polls.
- `.github/workflows/ci.yml` — path filters extended to cover release-bump
  files, so a bump commit produces the checks the gate reads.
- `.github/release.yml` (new) — categories and attribution for the generated,
  contributor-facing release body.
- `.github/workflows/ci.yml` or a small script — the heads-up guard: cross-check
  `BREAKING CHANGE` footers since the last tag against the `CHANGELOG.md` entry.
- `docs/store-submission.md` — the automated path, required secrets, the
  consent-screen prerequisite, and the zip-not-crx correction.
- Repository secrets (four): OAuth client id, client secret, refresh token, and
  the Chrome Web Store extension id. No signing key is involved.
- No `src/` changes. No new runtime dependency. No storage-format change.
  Nothing about the shipped extension's behavior changes.

### Depends on

`CHANGELOG.md` and its entry format are introduced by the companion change
**whats-new-after-update**, which is implemented first and which bakes the
current entry into the bundle. This change consumes that format in two places —
the heads-up guard and the release-body generation — and adds no changelog
machinery of its own. Implementing this change against a repository with no
`CHANGELOG.md` would leave both guards with nothing to read.
