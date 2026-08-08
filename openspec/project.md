# web-desktop

## Description

Chrome extension that replaces the new-tab page with a "desktop" of
bookmark icons.

- Bookmarks/subfolders shown as icons on an invisible grid, paginated
  (carousel) per folder when items exceed one page.
- Icon position persists per item across tabs and restarts, stored as a
  capacity-free slot. Resizing the window reflows where icons are drawn but
  never rewrites what is stored, so returning to a size restores its layout
  exactly.
- Icons scale with window resize while below their maximum size; once at
  maximum size, further widening increases the grid's cell count instead.
- Click a bookmark icon → navigate to its URL.
- Sidebar shows the folder tree (Chrome's native order); selecting a
  folder filters the canvas to its direct bookmark children. Folders are
  sidebar-only and never appear on the canvas.
- Default icon = favicon of the URL, with a generic fallback.
- Label shown under icon or as tooltip (configurable).
- Layout/data stays in sync live across all open new-tab pages.

Detailed design decisions (icon assets, pagination UX, label config scope,
etc.) are tracked via OpenSpec changes, not this file.

## Tech Stack

- Manifest V3 Chrome extension (new-tab override + service worker)
- TypeScript (strict)
- Vite + `@crxjs/vite-plugin`
- UI framework (e.g. React) + drag-and-drop lib (e.g. `dnd-kit`)
- `chrome.storage.local` for layout/settings; `chrome.bookmarks` API is the
  source of truth for bookmark structure
- Favicons via MV3 `_favicon` API (`favicon` permission), not the
  deprecated `chrome://favicon/<url>`
- ESLint + Prettier via pre-commit hooks
- Tests: Vitest (unit) + **Playwright e2e** (loads the unpacked extension
  in real Chromium; required — covers drag/persist, folder nav, click
  navigation, favicon fallback, multi-tab sync)
- CI (e.g. GitHub Actions): typecheck, lint, unit, e2e on every PR; merges
  blocked unless green

## Security Best Practices (required)

- Least-privilege manifest permissions
- No `eval`/remote code — stick to MV3 default CSP
- Sanitize all rendered bookmark titles/URLs, never raw `innerHTML`
- Validate URLs before navigation (block `javascript:` etc.)
- No secrets in repo
- Audit dependencies (`npm audit` / Dependabot)
- No off-device data transmission beyond declared favicon fetches
  (HTTPS only)
- Security tooling (free, no API keys, CI-friendly): `eslint-plugin-no-unsanitized`
  (already gates `npm run lint`/CI — blocks unsanitized `innerHTML`/`insertAdjacentHTML`
  etc.), [Retire.js](https://github.com/RetireJS/retire.js) (`npx retire`,
  scans for known-vulnerable JS libraries in the packaged extension), and
  [Semgrep](https://semgrep.dev/) community rulesets (`p/security-audit`,
  `p/javascript`, run via the free `semgrep` CLI — dangerous-function/pattern
  scan). Retire.js/Semgrep run weekly + on-demand via
  `.github/workflows/security-scan.yml` (separate from per-PR CI, so a
  finding never blocks a merge). See `SECURITY.md` for the manual steps
  around packing a stable-keyed `.crx` for an actual Web Store submission.

## Development Best Practices (required)

- TypeScript strict mode, no implicit `any`
- Lint/format enforced pre-commit and in CI
- Small PRs, required code review
- Conventional commits
- CI must be green (typecheck, lint, unit, e2e) before merge
- Design/requirement changes tracked via OpenSpec, not left implicit
