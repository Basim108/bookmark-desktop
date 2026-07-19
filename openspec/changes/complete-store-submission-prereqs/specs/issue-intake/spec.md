## ADDED Requirements

### Requirement: Structured Bug Reports

The repository SHALL provide a bug-report template that collects the context a
maintainer cannot reconstruct after the fact: the extension version, the browser
version, the operating system, the steps that produce the problem, and what the
reporter expected instead of what happened.

The template SHALL be answerable by a non-technical user. It SHALL NOT require
information a person who merely installed the extension cannot obtain — no
console output, no stack traces, no build steps as required fields. Diagnostic
detail MAY be requested optionally.

#### Scenario: A report carries reproduction context
- **WHEN** a bug report is filed through the template
- **THEN** it records the extension version, browser version, operating system, reproduction steps, and expected versus actual behavior

#### Scenario: A non-technical user can complete the template
- **WHEN** someone who has only installed the extension opens the bug-report template
- **THEN** every required field is one they can answer without developer tooling

### Requirement: Feature Requests Capture Intent

The repository SHALL provide a feature-request template that asks what the user
is trying to accomplish, not only what they want built — so a request can be
evaluated against the extension's single purpose rather than implemented
literally.

#### Scenario: A request states the underlying goal
- **WHEN** a feature request is filed through the template
- **THEN** it records the outcome the user is trying to reach, not only the change they proposed

### Requirement: Non-Bug Enquiries Are Routed Away From the Tracker

The issue tracker SHALL present, at the point of filing, links for enquiries
that are not bug reports or feature requests — at minimum the privacy policy and
the store listing — so questions of that kind do not arrive as issues.

#### Scenario: Filing offers non-issue routes
- **WHEN** a visitor opens the "new issue" chooser
- **THEN** it presents links to the privacy policy and the store listing alongside the bug-report and feature-request templates
