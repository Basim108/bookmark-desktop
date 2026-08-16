## ADDED Requirements

### Requirement: Publishing a GitHub Release Is the Only Trigger

A new version SHALL reach the Chrome Web Store by exactly one route: publishing
a GitHub release. No push, merge, schedule, or manual dispatch SHALL cause a
submission, so that shipping is always a deliberate act with a single, auditable
origin.

Publishing a previously drafted release SHALL trigger the same route, so a
release body can be prepared and reviewed before it takes effect.

#### Scenario: A published release submits the extension
- **WHEN** a GitHub release is published
- **THEN** the extension is built from the tagged commit and submitted to the Chrome Web Store

#### Scenario: Ordinary repository activity submits nothing
- **WHEN** a commit is pushed or a pull request is merged without a release being published
- **THEN** no submission to the Chrome Web Store occurs

#### Scenario: Publishing a draft triggers the release
- **WHEN** an existing draft release is published
- **THEN** the submission proceeds exactly as it would for a release published directly

### Requirement: The Tag and the Manifest Version SHALL Agree

The release SHALL be refused unless the released tag names the same version as
the extension's package metadata, from which the manifest version is derived. A
leading `v` on the tag SHALL be ignored for the comparison, so `v1.1.0` and a
package version of `1.1.0` agree.

The comparison SHALL happen before anything is built or uploaded, so a
mismatched release costs nothing beyond a failed run.

#### Scenario: Matching tag and version proceeds
- **WHEN** a release is published for tag `v1.1.0` and the package version is `1.1.0`
- **THEN** the release proceeds

#### Scenario: Mismatched tag and version is refused
- **WHEN** a release is published for tag `v1.2.0` and the package version is `1.1.0`
- **THEN** the release fails with a message naming both values, and nothing is built or uploaded

### Requirement: Only a Proven Commit Is Released

The release SHALL be refused unless the tagged commit has already completed its
continuous-integration checks successfully. The release process SHALL NOT run
those checks itself; it consumes the verdict of the run that already happened.

A commit carrying **no** checks SHALL be treated as unproven and refused. The
gate SHALL require at least one successful required check rather than merely the
absence of a failed one, because absence of evidence is not evidence of success.

The continuous-integration configuration SHALL run on the files a release-bump
commit touches — the package metadata, the lockfile, and the user-facing
changelog — so that such a commit produces the checks this gate reads.

#### Scenario: A green commit is released
- **WHEN** the tagged commit's required checks have all concluded successfully
- **THEN** the release proceeds

#### Scenario: A failed commit is refused
- **WHEN** any required check on the tagged commit concluded in failure
- **THEN** the release fails without building or uploading

#### Scenario: A commit with no checks is refused
- **WHEN** the tagged commit has no completed required checks at all
- **THEN** the release fails, rather than passing on the absence of failures

#### Scenario: A release-bump commit produces checks
- **WHEN** a commit changes only the package metadata, the lockfile, and the changelog
- **THEN** the continuous-integration workflow runs on it and produces required checks

### Requirement: The Submitted Package Is Built From the Tagged Commit

The submitted package SHALL be produced by building the repository at the
released tag during the release run, and SHALL NOT reuse any previously built
output. The package SHALL be a plain zip archive of the build output; no signing
key SHALL be required or used, since the store signs the published item itself.

#### Scenario: The package is freshly built
- **WHEN** a release is published
- **THEN** the extension is built from a clean checkout of the tagged commit and packaged as a zip

#### Scenario: No signing key participates
- **WHEN** the release run is inspected for the credentials it consumes
- **THEN** no extension signing key is among them

### Requirement: The Package Is Uploaded and Submitted for Review

The release SHALL upload the package to the extension's Chrome Web Store item
and submit it for review. Every precondition that can refuse a release SHALL be
evaluated before the upload, so the irreversible step is the last one taken.

#### Scenario: A valid release is submitted
- **WHEN** all preconditions pass
- **THEN** the package is uploaded to the store item and submitted for review

#### Scenario: Guards run before the upload
- **WHEN** any precondition fails
- **THEN** the failure occurs before the package is uploaded, leaving the store item untouched

### Requirement: The Release Body Serves Contributors

The GitHub release body SHALL be generated from the repository's commit history
and addressed to contributors. It SHALL include the complete set of changes
since the previous release — dependency updates included — with author and pull
request attribution.

It SHALL NOT be the source of the user-facing release notes, which are
maintained separately as the user-facing changelog.

#### Scenario: The release body lists all changes
- **WHEN** a release body is generated
- **THEN** it lists the changes since the previous release with author and pull request attribution, including dependency updates

#### Scenario: The two documents stay separate
- **WHEN** the release body is compared with the user-facing changelog entry for the same version
- **THEN** the release body carries contributor-level detail while the changelog carries the concise user-facing summary, neither derived from the other

### Requirement: A Breaking Change SHALL NOT Ship Unannounced

When any commit since the previous release records a breaking change — by
conventional-commit footer or by type marker — the user-facing changelog entry
for the new version SHALL carry a heads-up line addressed to users. The project
SHALL refuse the change otherwise.

The check SHALL run on the pull request that introduces the version bump, so a
missing heads-up is corrected before a version number is consumed.

The heads-up text SHALL be written for users and SHALL NOT be copied from the
commit footer, which addresses contributors.

Recording a breaking change SHALL NOT by itself determine the version number,
which remains a human judgment about user-visible impact.

#### Scenario: A breaking change without a heads-up is refused
- **WHEN** a commit since the previous release records a breaking change and the changelog entry for the new version has no heads-up line
- **THEN** the check fails and the version cannot be released

#### Scenario: A breaking change with a heads-up passes
- **WHEN** a commit since the previous release records a breaking change and the changelog entry carries a heads-up line
- **THEN** the check passes

#### Scenario: The marker is detected in a commit footer
- **WHEN** a commit records its breaking change in a footer rather than with a type marker
- **THEN** the check detects it

#### Scenario: A release with no breaking change needs no heads-up
- **WHEN** no commit since the previous release records a breaking change
- **THEN** the check passes without requiring a heads-up line

### Requirement: The Outcome Reported Is Submission, Not Publication

The release SHALL report that the version was **submitted for review**, and
SHALL NOT state or imply that it is live for users. Store review is
asynchronous, may take days, and may reject.

The release MAY additionally report the item's review outcome once it is known.
Such reporting SHALL NOT cause an otherwise successful submission to be recorded
as a failure.

#### Scenario: Success is reported as submission
- **WHEN** the upload and publish steps succeed
- **THEN** the run reports that the version was submitted for review, not that it is available to users

#### Scenario: Outcome reporting does not rewrite a successful submission
- **WHEN** the optional review-outcome reporting cannot reach a conclusion, or the review is rejected
- **THEN** the successful submission is not recorded as a failed one

### Requirement: Operational Prerequisites Are Recorded

The repository SHALL document the operational prerequisites for automated
publishing that no automation can enforce or detect, so that a failure months
later is diagnosable from the repository alone.

The documentation SHALL state that the publishing credentials' OAuth consent
screen must be published (or internal) **before** the long-lived credential is
generated, and that a credential generated while the consent screen is in a
testing state expires after seven days regardless of any later change to that
state.

The documentation SHALL also correct the record on packaging: store submission
uses a plain zip and no signing key.

#### Scenario: The credential lifetime hazard is documented
- **WHEN** the release documentation is read
- **THEN** it states that the consent screen must be published or internal before the credential is generated, and that a credential generated under a testing consent screen expires after seven days

#### Scenario: The packaging requirement is documented accurately
- **WHEN** the submission documentation is read
- **THEN** it states that store submission uses a plain zip archive and requires no signing key
