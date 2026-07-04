# Security

## Automated tooling

### Every PR / push to `main` (`.github/workflows/ci.yml`)

- `npm audit --audit-level=high` — dependency vulnerabilities
- `eslint-plugin-no-unsanitized` (via `npm run lint`) — blocks unsanitized
  `innerHTML`/`insertAdjacentHTML`/etc. at lint time
- Dependabot (`.github/dependabot.yml`) — weekly PRs for npm, devcontainer,
  and GitHub Actions dependency updates

### Weekly scheduled scan (`.github/workflows/security-scan.yml`)

Runs separately from per-PR CI so a flagged finding never blocks a merge —
it shows up as a red run in the **Actions** tab instead.

- **Retire.js** (`npm run security:retire`) — flags known-vulnerable
  JavaScript libraries in the built extension
- **Semgrep** (`p/security-audit` + `p/javascript` + `p/typescript`
  community rulesets, `--error` so findings fail the job) — dangerous
  function/pattern static analysis (`eval`, unsafe postMessage, etc.)

Both are free, require no account/login, and need **no GitHub secrets** —
this workflow runs with zero repo configuration beyond the file itself.
You can also trigger it on demand from the Actions tab
(`workflow_dispatch`) instead of waiting for the weekly cron.

### Running these locally

The devcontainer (`.devcontainer/`) sets both up automatically — no
manual installs needed:

- `retire` is an npm devDependency; `npm run security:retire` just works.
- Semgrep is installed via `pipx` in `postCreateCommands.sh` (pipx avoids
  Debian's PEP 668 restriction on installing Python packages into the
  system interpreter); run it with the same command as CI:
  `semgrep --error --config p/security-audit --config p/javascript --config p/typescript --exclude node_modules --exclude dist --exclude "*.test.*" --exclude e2e src/ manifest.config.ts`
- Playwright's Chromium (needed for `npm run test:e2e`) is installed via
  `npx playwright install --with-deps chromium`.

If you're not using the devcontainer, run those same commands yourself
once.

## GitHub repo setup

**Nothing is required for the workflow above to run.** Everything it uses
(`npm audit`, Retire.js, Semgrep community rules) is free and keyless.

Optional, recommended:

- **Code scanning default setup (CodeQL)** — free for public repos, zero
  config. Enable in _Settings → Code security → Code scanning → Set up →
  Default_. No secret needed; GitHub runs and hosts it.
- **Scheduled-workflow failure notifications** — GitHub emails whoever's
  watching the repo (or who last edited the workflow file) when a
  scheduled run fails, by default. Confirm your notification settings
  (_Settings (user) → Notifications_) pick this up, since a failed
  weekly scan is easy to miss otherwise.
- **Slack/webhook alerts on scan failure** — not wired up. If you want
  this, it needs a `SLACK_WEBHOOK_URL` (or similar) repo secret and a
  notification step added to the workflow; ask before adding, since it's
  a new external destination for CI data.

## Manual activities (not automated)

### Reviewing scan results

When `security-scan.yml` goes red, open the run in the Actions tab and
read the Retire.js/Semgrep output directly in the job log — resolve or
consciously accept each finding before the next release.

### Before each Chrome Web Store submission

1. `npm run build` then pack: run Chromium with
   `--pack-extension=dist --pack-extension-key=<path-to-existing-key.pem>`
   (omit `--pack-extension-key` only on the very first pack, when there
   is no key yet — Chrome generates one alongside the `.crx`).
2. Re-run `npm run security:retire` and the Semgrep command above (or just
   trigger `security-scan.yml` manually) and resolve any findings.
3. Upload the `.crx` (or the `dist` folder as a zip, per the Chrome Web
   Store Developer Dashboard's current requirements) manually — store
   submission itself isn't automated.

### Protecting the `.crx` signing key

The `.pem` generated during packing is a **private key** — output goes to
the gitignored `security/` directory and must never be committed. It
determines the extension's ID, so losing it (or generating a new one) on
a future submission changes the extension's identity, breaking existing
installs' update path.

- Store it in a password manager / secrets vault (1Password, Bitwarden,
  etc.), not in the repo, not in Slack/email. "Not in the repo" means the
  working tree too, not just git history: `security/` is gitignored so
  packing won't accidentally commit it, but the file still sits on disk
  where any process running in this workspace (an `npm install` lifecycle
  script, an editor extension, etc.) can read it. Move it to the vault and
  delete it from `security/` right after packing — don't leave it there
  between submissions.
- If you later want CI to pack (or publish) releases automatically,
  base64-encode the `.pem` and add it as a GitHub Actions secret (e.g.
  `CRX_SIGNING_KEY`), then decode it into a temp file in the workflow
  before packing. Not currently set up — flag it explicitly if you want
  that added, since it means a private key lives in GitHub's secret
  store.
