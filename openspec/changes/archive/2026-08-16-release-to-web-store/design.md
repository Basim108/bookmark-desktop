## Context

Every release today is done by hand: bump `package.json`, `npm run build`, zip
`dist/`, upload through the Developer Dashboard. The repository already carries
most of the discipline a release needs — conventional commits enforced by
commitlint, a green-CI-before-merge rule, OpenSpec change tracking, generated
store assets — but none of it is wired to the act of shipping. The result is 61
merged commits sitting behind a manual chore.

Three constraints shape the design:

1. **The Chrome Web Store API has no release-notes field.** Its v1.1 surface is
   upload, publish, and get. Listing text is dashboard-only, and there is no
   per-version "what's new" concept anywhere in the store — not for users, not
   for the API. Release notes therefore cannot be *published to the store*; they
   travel inside the bundle. That half is the companion change
   **whats-new-after-update**.
2. **Two audiences want different documents.** A contributor bisecting a
   regression wants all 61 commits including the 21 dependency bumps. A user
   wants four sentences. Trying to serve both from one artifact was the thing
   making the format awkward, so this change keeps them separate: the GitHub
   release body is generated from git for contributors; `CHANGELOG.md` is
   written by hand for users.
3. **Publishing is asynchronous and irreversible-ish.** Review takes hours to
   days, can reject, and a version number once uploaded cannot be reused. The
   workflow's guards therefore run *before* anything is uploaded.

## Prerequisite: OAuth consent screen

**This change must not be implemented until this is confirmed.**

Chrome Web Store publishing authenticates with a Google OAuth refresh token. If
the Google Cloud project's consent screen is in **Testing** status, Google
expires refresh tokens **after seven days**. The failure mode is maximally
confusing: the first release works, and a release a week or more later fails
with `invalid_grant` and no indication that the token, rather than the workflow,
is at fault.

The consent screen must be **Published** (or **Internal**, if the account
belongs to a Workspace organization) *before* the refresh token is generated. A
token minted under Testing status does not become long-lived when the consent
screen is later published — it must be regenerated afterwards.

No workflow step can perform this, and none can detect it in advance: a
seven-day-old token is indistinguishable from a permanent one until it expires.
It is recorded here, in the proposal, and in `docs/store-submission.md` because
documentation is the only available mitigation.

## Goals / Non-Goals

**Goals:**

- One deliberate human act — publishing a GitHub release — produces a store
  submission, with everything else derived.
- Refuse to ship rather than ship something wrong: mismatched version, unproven
  commit, or an unannounced breaking change all stop the release before upload.
- The release body serves contributors completely and automatically.
- Record the operational prerequisites that no automation can enforce.

**Non-Goals:**

- Deciding the version number. Semantic versioning is a judgment call about user
  impact, made by a human in the bump PR.
- Writing user-facing copy. Generated notes cannot produce it (see Decision 2).
- Running tests. The release gates on CI's verdict rather than re-deriving it
  (Decision 4).
- Changing anything about the extension's runtime behavior. This change touches
  no file under `src/`.
- Editing the store listing — description, screenshots, categories. The API
  cannot; those stay dashboard-managed.
- Self-distribution via a signed `.crx`. Store uploads are plain zips.

## Decisions

### Decision 1: `package.json` is the version's source of truth; the tag must agree

The workflow reads the tag, strips a leading `v`, and compares it to
`package.json`'s `version`. Any disagreement fails the release before anything
is built.

`manifest.config.ts` already derives `version` from `package.json`, so the
manifest cannot drift from the package metadata. The remaining gap is between
the package and the tag, which this closes.

*Alternative considered — the tag is truth, and the workflow rewrites
`package.json` at build time.* Releasing needs no prep commit, but `main` then
permanently misstates the shipped version unless the workflow commits back,
which means a bot push to a protected branch. It also removes the version bump
from review, and the bump is precisely the moment somebody decides whether a
change is major, minor, or patch. Rejected: the manual step is the feature.

*Alternative considered — derive the version from conventional commits
(release-please and similar).* Would have produced the bump PR automatically.
Rejected as more machinery than the project needs, and it would have forced
`2.0.0` for the storage-slot migration (see Decision 6) on a rule that does not
match user-visible impact.

**Tag format.** Tags are `v`-prefixed going forward (`v1.1.0`). The existing
`1.0.0` tag is bare while its release is *titled* `v1.0.0`; nothing compares
tags to each other, so standardizing forward costs nothing and needs no
retroactive fix.

### Decision 2: generation drafts, humans write

Filtering commits into user-facing release notes does not work, and the
repository's own history shows why. Of 61 non-merge commits since `1.0.0`:

| Category | Count | User-facing? |
| --- | --- | --- |
| `chore(deps*)` — dependabot | 21 | no |
| `chore`/`docs(openspec)` — bookkeeping | 16 | no |
| `fix` | 11 | ~7 (three are `npm ci`, `npm audit`, devcontainer setup) |
| `feat` | 9 | ~5 (five uTab commits are one user-visible capability) |
| test / revert / other | 4 | no |

Excluding dependabot — the filter that seems obvious — still leaves 40. And
these five commits:

```
feat(import): add per-entry uTab import report and fix the hang on failure
feat(import): fall back instead of skipping blank uTab names
feat(import): ignore empty uTab grid slots instead of reporting them
feat(import): one import flow, reported where it was started
feat(sidebar): import uTab bookmarks into root folders
```

are one line to a user: *"Bring your uTab bookmarks across in one step."* No
mechanical transformation produces that. Commit count is not feature count.

So the division of labour is: **machines enforce structure, humans write voice.**
Generation produces the contributor-facing release body, where a raw commit list
is exactly the right artifact. `CHANGELOG.md` is written by hand in the bump PR,
where CI can check that it exists, is within the length limits, and carries a
heads-up when one is required — without ever trying to check whether the prose
is any good.

### Decision 3: two artifacts, two audiences

| | GitHub release body | `CHANGELOG.md` |
| --- | --- | --- |
| Audience | contributors | users |
| Authored by | generated from git | written by hand |
| Dependency bumps | included | never mentioned |
| Attribution | `by @author in #PR` | none |
| Length | complete | 3–6 bullets |
| Bug fixes | listed individually | one rolled-up sentence |
| Lives in | GitHub | the repository |
| Consumed by | humans reading the release page | the extension bundle |

`CHANGELOG.md` being *in the repository* is the load-bearing property. It
arrives in the bump PR: reviewable, diffable, and checkable by CI before the
release exists. Copy authored in a GitHub release body is none of those things,
and a typo there costs a version number to fix.

This follows a rule the repository already applies. `pages.yml` builds the
published privacy policy from `PRIVACY.md` rather than from a copy under
`site/`, so the two cannot drift. Same principle: one source, derived outputs,
never a second copy.

### Decision 4: gate on CI's verdict; do not re-run tests

The release job runs no tests. It queries the check runs for the tagged commit
and refuses to proceed unless they are conclusively successful.

**Absence of checks is failure, not success.** The gate requires at least one
successful required check — a commit with no checks at all is unproven, not
proven. This is not hypothetical: `ci.yml` currently filters on `src/**`,
`e2e/**`, and `.github/**`, and a release-bump commit touches `package.json`,
`package-lock.json`, and `CHANGELOG.md` — **none of which match**. Today such a
commit produces zero check runs. A naive "no failures found" gate would wave it
straight through.

Two fixes, both required:

1. Extend `ci.yml`'s path filters to cover the release-bump files, so the bump
   PR and its merge commit produce a full CI run.
2. Treat "no checks found" as a hard failure in the gate.

*Alternative considered — re-run the full suite in the release job.* A few
minutes' cost, and it would protect against tagging a commit whose CI predates a
change. Rejected in favour of speed and non-duplication; the merge-to-`main`
requirement already means the tagged commit has been through CI, and fix (1)
above closes the specific hole. Worth revisiting if a release is ever cut from a
commit that is not on `main`.

### Decision 5: guard the breaking-change announcement mechanically

If any commit since the previous tag carries a `BREAKING CHANGE` footer or a `!`
type marker, the `CHANGELOG.md` entry for the new version must carry a heads-up
line. CI fails otherwise.

The signal already exists in this repository: `fix(canvas): store bookmark
positions as capacity-free slots` carries a `BREAKING CHANGE` footer. Note it is
a `fix`, not a `feat!` — **the detector must read commit footers, not only the
`!` marker.**

Running this check on the bump PR rather than at release time matters: on the PR
a missing heads-up is a one-line edit, while at release time it costs a burned
version number.

The heads-up *text* is written for users and lives in `CHANGELOG.md`, never
copied from the footer. The same event reads very differently to the two
audiences:

```
footer   BREAKING CHANGE: the positions storage key changes shape. Existing
         data is migrated on read...

heads-up Your icon layout settles into place once after this update — nothing
         is lost.
```

### Decision 6: the guard's signal is not the version number

The same `BREAKING CHANGE` footer that triggers Decision 5 would, under strict
conventional-commits/semver, imply a major bump. It deliberately does not.

Nothing breaks *for a user*: the data migrates on read and the visible
consequence is a one-time reflow. The first automated release is therefore
`1.1.0`, not `2.0.0`. The footer drives the announcement; the version number
stays a human judgment about user impact, made in the bump PR.

### Decision 7: report submission honestly

The publish endpoint returns success on *submission*. Review is asynchronous,
takes hours to days, and can reject. A green workflow means "handed over", and
the job's summary says so in those words rather than "published".

Polling the item's review state afterwards is included as an optional final
step, so the outcome can surface without anyone watching a dashboard. It is
marked optional because a rejection is actionable whenever it is noticed, and a
polling loop that outlives the job's timeout must not fail an otherwise
successful release.

## Risks / Trade-offs

- **[Refresh token expires after 7 days]** → The consent screen must be
  Published or Internal *before* the token is generated. Documented in three
  places; blocks implementation. No automated detection is possible.
- **[A partially-successful run cannot be retried]** → The store rejects a
  re-upload of an existing version, so re-running a workflow that failed after
  upload but before publish will 400. Ordering all guards before the upload
  keeps the irreversible step last, and the recovery path (publish the already
  uploaded draft from the dashboard) is documented rather than automated.
- **[The bump commit produces no CI checks]** → Decision 4, fixes (1) and (2).
  Without both, the gate silently passes everything.
- **[Release notes are a snapshot]** → Editing the GitHub release body after
  publication does not change the shipped bundle. `CHANGELOG.md` being the
  source, and arriving via a reviewed PR, keeps the correction window before the
  release rather than after it.
- **[Secrets in a public repository's workflow]** → Four repository secrets, all
  referenced through `secrets.*`, never echoed. The workflow does not run on
  `pull_request`, so a fork PR cannot reach them.
- **[Store review rejects the submission]** → Not preventable here. Decision 7
  makes the outcome visible instead of implying success.

## Migration Plan

1. Confirm the OAuth consent screen is Published or Internal. **Blocks
   everything below.**
2. Generate the refresh token *after* step 1; add the four repository secrets.
3. Land `whats-new-after-update`, which introduces `CHANGELOG.md` and its
   format. This change's guards have nothing to read without it.
4. Extend `ci.yml`'s path filters (Decision 4) and add the heads-up guard.
5. Add `.github/release.yml` and `.github/workflows/release.yml`.
6. Author the `1.1.0` bump PR: version, changelog entry summarizing 61 commits
   into four or five user-facing lines, and the heads-up for the layout reflow.
7. Merge, tag `v1.1.0`, publish the release, watch the workflow.
8. Verify the submission appears in the Developer Dashboard.

**Rollback:** the workflow is additive and triggers only on
`release: published`. Deleting or disabling it restores the manual path exactly;
nothing else depends on it. A bad submission is withdrawn from the dashboard,
not from here.

## Open Questions

- **Review polling shape** — how long to poll, and whether a rejection should
  fail the job (visible, but retroactively reddens a run that did its part
  correctly) or only annotate it. Deferred; the step is optional.
- **Releasing from a non-`main` commit** — currently unconsidered. If it ever
  happens, Decision 4's reasoning weakens and re-running tests in the release
  job becomes the safer choice.
- **Draft-release flow** — publishing a draft fires `release: published` the
  same way, so drafts work by construction, but the flow is not yet documented
  as the recommended one.
