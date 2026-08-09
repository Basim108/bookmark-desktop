## Context

The extension currently tells users nothing about itself. There is no version
anywhere in the UI — despite `.github/ISSUE_TEMPLATE/bug_report.yml` asking
reporters for one — and no account of what changed when Chrome updates the
extension underneath them.

The immediate trigger is concrete. `fix(canvas): store bookmark positions as
capacity-free slots` carries a `BREAKING CHANGE` footer: positions are migrated
on read and nothing is lost, but every user's icons visibly settle into
different places once. Without a word from the extension, the honest engineering
that made the migration safe is indistinguishable from data loss.

Two constraints rule out the obvious alternatives:

- **The store cannot carry this.** The Chrome Web Store API is upload, publish,
  get. There is no release-notes field, and no per-version "what's new" concept
  anywhere in the store for users to read.
- **The extension cannot fetch it.** The published privacy policy states that
  all handled data stays on the device and that the only outbound requests are
  the declared favicon fetches through the MV3 `_favicon` API. A runtime request
  to a release API would break that sentence, force a policy revision, and
  arguably change the store's data-use disclosures — for a changelog.

So the notes are a build artifact, baked into the bundle.

## Goals / Non-Goals

**Goals:**

- A user who is about to be surprised by a change hears it from the extension
  first.
- Notice arrives without requiring the user to go looking for it.
- It appears once and does not become wallpaper.
- Anything missed remains retrievable on demand.
- The running version is visible in the UI.

**Non-Goals:**

- A full version history. The bundle carries the current entry only.
- Anything on screen during ordinary use. Between releases this feature is
  invisible.
- Automating the copy. Generated notes cannot produce user-facing prose — see
  `release-to-web-store`'s design, Decision 2.
- Automating the release itself. That is the companion change; this one is
  useful with a manual release process.
- Marketing surfaces — no ratings prompt, no upsell, no "share this".

## Decisions

### Decision 1: the service worker detects the update; the page displays it

`chrome.runtime.onInstalled` fires in the service worker, which may be the only
context running when an update lands — the new-tab page might not be open at
all. So the worker records the transition and the page reads it:

```
service worker                          new-tab page
──────────────                          ────────────
onInstalled
  reason "install"  → seenVersion = current
                      (no notice; new users have no history)
  reason "update"   → pendingNotice = { from, to }
                                    │
                       storage.local│
                                    └──────▶ read on mount
                                             restoration completes
                                             open the window
```

**The discriminator is `reason`, not the absence of stored state.** Every user
upgrading from `1.0.0` has no stored version, because the key did not exist
then — they are updates, not installs. Keying off "nothing stored" would either
show a changelog to brand-new users or hide it from every existing one on the
first release that has this feature. Only `onInstalled` distinguishes them.

Pleasant consequence: the existing 20 e2e specs need no changes. A fresh
Playwright profile loading the unpacked extension fires `reason: "install"`, so
no window appears over `smoke.spec.ts` and its peers.

### Decision 2: open after restoration, not on mount

`App.tsx` already models restoration explicitly as `restoring | restored`,
because painting the wrong folder for a frame was judged unacceptable on the
surface users see most often. The window waits for the same signal.

This is not only cosmetic. A new-tab page is very often opened in order to be
left immediately — the user types in the omnibox and navigates away within a
few hundred milliseconds. Waiting for restoration means the window never renders
for those visits, so it does not consume its appearance on a user who was never
going to read it. It renders for users who linger, which is exactly the audience
it is for.

### Decision 3: marked seen on close, not on display

Any dismissal — the close control, Escape, or the backdrop — marks the version
seen. Merely rendering the window does not.

The trade-off is real and was chosen deliberately. Marking on display would
guarantee the window appears at most once ever; marking on close means a user
who navigates away without dismissing sees it again on their next unhurried new
tab. That is the intended behavior: the point is that the user *received* the
message, and a window that flashed past during a page load they abandoned did
not deliver it.

Two properties keep the repeat bounded rather than annoying. Decision 2 means
the window only renders for visits where the user stays, so a repeat implies
they saw it and chose not to act. Decision 4 means one dismissal settles it
everywhere at once. And dismissal is maximally forgiving — three ways to do it,
including clicking anywhere outside the window.

*If this ever does feel naggy in practice*, the knob is a cap: show at most N
times, then self-clear. Deliberately not built now — that is a change to make on
evidence.

### Decision 4: seen state is shared, and is not user data

The state lives in `chrome.storage.local` under its own top-level key, so
`onChanged` propagates a dismissal to every open new-tab page. A user with
pinned new tabs dismisses once, not once per tab.

Its own key, rather than a field inside `generalSettings`, follows the reasoning
already recorded for `lastFolderId`: a top-level key can be written without
read-modify-writing a record another writer shares.

It is **excluded from state export/import**, joining `lastFolderId` and
`gridCapacity` — state describing this installation, not a setting the user
configured. Including it would let a backup restored from another machine either
suppress a notice the user has not seen or resurrect one they already dismissed.

### Decision 5: one window, two entrances, each leading with what was asked for

The same component serves both entrances. Each leads with the thing the user
came for, so the ordering differs rather than only the heading:

| Entrance | Heading | Body |
| --- | --- | --- |
| opened by itself after an update | "What's new" | the news, immediately |
| About button in Settings | "About" | what the extension is, a rule, then a "What's new" section carrying the same notes |

The release notes are common to both; only the introduction is conditional. The
About entrance is the one place inside the product that answers "what is this
and where does my data go" — worth two sentences, given Chrome warns at install
that the extension can read and change bookmarks. After an update that
introduction would be an obstacle between the user and the news, so it is not
rendered there, and the window's own title already says what the window is.

*Alternative considered — identical content from both entrances, differing only
in the heading.* Simpler, and what this design originally specified. Rejected on
seeing it: the About entrance opened onto a bare changelog, which answers a
question nobody arrived with.

*Alternative considered — a single "About Bookmark Desktop" title for both.* More
honest about the window's contents, but it buries the news on the entrance where
the news is the entire point. A conditional heading is a smaller cost than a
misleading one.

*Alternative considered — two components.* Duplicates the notes, the footer, and
every dismissal route for one conditional block.

### Decision 6: About opens stacked above Settings

The release-notice window opens **above** the Settings window, which stays
mounted beneath it. Escape and the backdrop dismiss only the topmost window.

The alternative of closing Settings first would silently discard staged
background edits — Settings stages every edit and applies atomically on Save —
which is a nasty papercut for someone who clicked About mid-configuration.
Swapping the Settings window's body for an About view avoids that too, but
introduces a view-stack concept the codebase does not have.

The stacking vocabulary already exists: `.import-toast` sits at `z-index: 200`
specifically so it stays visible above a window's `z-index: 100` backdrop.

### Decision 7: `CHANGELOG.md` is the source; the build bakes the current entry

The user-facing copy is written by hand in the version-bump pull request and
lives in the repository, where it is reviewable and diffable before release, and
where CI can check its shape.

The build parses the entry matching `package.json`'s version and makes it
available to the bundle. Missing or unparseable entry fails the build rather
than shipping an extension whose window would open empty.

Only the current entry ships. Carrying several would make a skipped upgrade
(`1.0.0` → `1.3.0`, possible for an extension disabled for a while) coherent,
but costs history in the bundle for a rare case; the About entrance and the
GitHub releases page both remain available.

This mirrors a rule the repository already follows: `pages.yml` builds the
published privacy policy from `PRIVACY.md` rather than from a copy under
`site/`, so the two cannot drift. One source, derived outputs, never a second
copy — so the notes are never hand-maintained in `src/`.

### Decision 8: the heads-up is written for users, and is rare by construction

The heads-up block renders only when the changelog entry declares one. Its text
is written for users and never copied from a commit footer:

```
footer     BREAKING CHANGE: the positions storage key changes shape. Existing
           data is migrated on read...

heads-up   Your icon layout settles into place once after this update — nothing
           is lost.
```

It says what the user will *see* and what they need not worry about, never what
changed internally. Rarity is the design: against the 61 commits since `1.0.0`,
exactly one would have declared a heads-up. A block that appeared every release
would be ignored within three of them.

`release-to-web-store` adds the CI guard that refuses a release whose entry
omits a heads-up when a commit records a breaking change. This change defines
the field; that change enforces it.

### Decision 9: markdown is not rendered as markdown

The project bans raw `innerHTML` and gates it in CI with
`eslint-plugin-no-unsanitized`. Rather than introduce a markdown renderer and a
sanitizer for a bulleted list, the changelog entry is parsed at build time into
a small structure — heading, optional heads-up, bullets, closing sentence — and
rendered through React as ordinary elements.

This also keeps the concision honest: a structure with a bullet array has an
obvious length limit to check, where free-form markdown does not.

## Risks / Trade-offs

- **[A user dismisses without reading and loses the heads-up]** → The About
  entrance keeps it retrievable, and Decision 8 requires the heads-up sentence
  to be reassuring on its own rather than merely descriptive.
- **[The window repeats for a user who never dismisses it]** → Decisions 2 and
  4 bound it; the cap in Decision 3 is the escalation if evidence warrants.
- **[A modal on a new-tab page is intrusive]** → It renders on an update only,
  after restoration, once dismissed. Between releases the feature is invisible.
- **[The window fights the settings window for the Escape key]** → Decision 6
  makes the topmost window the sole handler; covered by explicit scenarios.
- **[A build ships with no notes]** → Failing the build on a missing or
  unparseable entry is preferable to shipping a window that opens empty.
- **[Seen state travels in a backup and misfires]** → Decision 4 excludes it
  from export/import, as with `lastFolderId`.

## Migration Plan

Users updating to the first version carrying this feature have no stored seen
state. `onInstalled` fires with reason `update`, so they see that version's
window — which is the intent, since that release carries the layout reflow.

Users installing fresh get reason `install`, their seen version is recorded, and
they see nothing.

**Rollback:** the feature is additive. Removing it leaves one unused storage key
and changes nothing else; no existing stored format is touched.

## Open Questions

- **Heads-up styling.** Distinct enough to read as a warning without being
  alarming. A visual call, best made against the real window.
- **What the About entrance shows beyond the notes.** Version and links to home,
  the issue tracker, and the privacy policy are the obvious set; whether it also
  links the full releases page is undecided.
- **Skipped versions.** Deliberately unsolved (Decision 7). If telemetry-free
  evidence ever suggests it matters, carrying the last few entries is a small
  follow-up.
