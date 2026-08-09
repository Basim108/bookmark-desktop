## 0. Blocking prerequisites

- [ ] 0.1 **Confirm the Google Cloud OAuth consent screen backing the publishing credentials is Published (or Internal).** Do not start any task below until this is confirmed — a refresh token generated under a **Testing** consent screen expires after seven days and fails every later release with an opaque `invalid_grant`. See design.md → "Prerequisite: OAuth consent screen"
- [ ] 0.2 Generate the refresh token **after** 0.1, not before; a token minted under Testing status does not become long-lived when the consent screen is published later
- [ ] 0.3 Add four repository secrets: OAuth client id, client secret, refresh token, and the Chrome Web Store extension id. No signing key — store uploads are plain zips
- [ ] 0.4 Confirm `whats-new-after-update` has landed, so `CHANGELOG.md` and its entry format exist for tasks 3 and 4 to read

## 1. Close the CI gap that would make the release gate vacuous

- [ ] 1.1 Extend `.github/workflows/ci.yml`'s `paths` filters (both `pull_request` and `push`) to include `package.json`, `package-lock.json`, and `CHANGELOG.md` — today a release-bump commit touches only these and matches **none** of `src/**`, `e2e/**`, `.github/**`, so it produces zero check runs
- [ ] 1.2 Verify the gap is closed before relying on it: open a branch touching only `package.json` and confirm CI actually runs on it

## 2. Contributor-facing release body

- [ ] 2.1 Add `.github/release.yml` configuring GitHub's generated release notes: categories for features, fixes, and dependencies, keeping dependency bumps **in** — they are 21 of the 61 commits since `1.0.0` and a contributor bisecting a regression wants them (design.md Decision 3)
- [ ] 2.2 Confirm the generated body carries `by @author in #PR` attribution, and that it does not attempt to serve the user-facing audience

## 3. Breaking-change announcement guard

- [ ] 3.1 Add a script that lists commits since the previous tag and detects a breaking change by **either** a `BREAKING CHANGE` footer **or** a `!` type marker — footer detection is load-bearing, since this repository's one real case is `fix(canvas): store bookmark positions as capacity-free slots`, a `fix` with a footer and no `!` (design.md Decision 5)
- [ ] 3.2 When a breaking change is present, require the `CHANGELOG.md` entry for the version in `package.json` to carry a heads-up line; fail with a message naming the commits that triggered the requirement
- [ ] 3.3 Wire the guard into `ci.yml` so it runs on the **bump pull request**, where a missing heads-up costs one line rather than a burned version number
- [ ] 3.4 Assert the guard passes silently when no breaking change is present, so ordinary releases are unaffected
- [ ] 3.5 Unit-test the detector against fixtures: footer-only, `!`-only, both, neither, and a footer inside a `fix` rather than a `feat`

## 4. Release workflow

- [ ] 4.1 Create `.github/workflows/release.yml` triggered solely by `release: published` — no push, schedule, or dispatch trigger (spec: "Publishing a GitHub Release Is the Only Trigger")
- [ ] 4.2 Assert the tag matches `package.json`'s version, stripping a leading `v`; fail with both values named. Run this first, before checkout of dependencies or any build
- [ ] 4.3 Gate on the tagged commit's check runs. Require **at least one successful required check**; treat "no checks found" as a hard failure, not as a pass (design.md Decision 4 — the trap task 1.1 exists to prevent)
- [ ] 4.4 Do **not** run the test suite here; the gate consumes CI's verdict rather than re-deriving it
- [ ] 4.5 Build from a clean checkout of the tagged commit (`npm ci && npm run build`) — never reuse a previously built `dist/`
- [ ] 4.6 Zip `dist/` and upload to the store item, then submit for review. Both steps come **after** every guard above, so the irreversible action is last
- [ ] 4.7 Write a job summary that says the version was **submitted for review**, explicitly not that it is live — review is asynchronous and can reject (design.md Decision 7)
- [ ] 4.8 Reference all credentials through `secrets.*` and never echo them; confirm the workflow has no `pull_request` trigger, so a fork PR cannot reach them
- [ ] 4.9 *(Optional)* Poll the item's review state after submission and report the outcome. Ensure a timeout or a rejection cannot record a successful submission as a failed run

## 5. Documentation

- [ ] 5.1 Add a release section to `docs/store-submission.md`: the trigger, the four secrets, the tag convention (`v`-prefixed, stripped for comparison), and the gates that can refuse a release
- [ ] 5.2 Document the OAuth consent-screen hazard from task 0.1 in that file, in the words a future maintainer debugging `invalid_grant` months later would search for
- [ ] 5.3 Correct the "Assets and package" section, which currently offers "a zip, or a packed `.crx`" and points at `SECURITY.md` for signing-key handling — the automated path uses a plain zip and no key. Leave the `.crx` guidance only where it belongs, as self-distribution
- [ ] 5.4 Document the recovery path for a run that fails between upload and publish: the store rejects re-uploading an existing version, so the already-uploaded draft is published from the dashboard rather than by re-running the workflow

## 6. First release

- [x] 6.1 Author the `1.1.0` bump PR: `package.json` version, and a `CHANGELOG.md` entry condensing 61 commits into four or five user-facing lines with the bug fixes rolled into one sentence — **done ahead of this change, in `whats-new-after-update`**: its build guard needs an entry matching the built version, so the bump and the entry landed with the feature that reads them
- [x] 6.2 Include the heads-up line for the layout reflow — the storage-slot migration is the one breaking change in this release, and task 3 will require it
- [x] 6.3 Confirm `1.1.0` is right rather than `2.0.0`: nothing breaks for a user, the data migrates on read, and the visible consequence is a one-time reflow (design.md Decision 6)
- [ ] 6.4 Merge, tag `v1.1.0`, publish the release, and watch the workflow through to submission
- [ ] 6.5 Verify the submission appears in the Developer Dashboard, and that the shipped bundle carries the `1.1.0` changelog entry the extension will show

## 7. Verification

- [ ] 7.1 Verify each refusal path deliberately: a mismatched tag, a commit with a failed check, and a commit with no checks at all each fail **before** any upload
- [ ] 7.2 Verify the breaking-change guard fails a bump PR whose changelog entry omits a required heads-up
- [ ] 7.3 Run `openspec validate release-to-web-store --strict` and confirm it passes
