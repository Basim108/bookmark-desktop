# Bookmark Desktop (web-desktop)

A Manifest V3 Chrome extension that replaces the new-tab page with a
"desktop" of your bookmarks: a grid of icons you can arrange, paginate,
and navigate through a folder sidebar, backed directly by Chrome's own
bookmark store.

## Features

- Bookmarks (and subfolders' bookmarks) render as icons on an invisible
  grid, paginated as a carousel per folder once items exceed one page
- Each icon's grid position (page/row/col) persists per folder, across
  tab reloads and browser restarts
- Icons scale continuously with window resize up to a configured maximum
  size; beyond that, the grid grows columns/rows instead
- Clicking a bookmark navigates the current tab to its URL (scheme
  is validated first — dangerous schemes like `javascript:`/`data:` are
  blocked)
- A sidebar shows Chrome's native folder tree; selecting a folder filters
  the canvas to that folder's direct bookmark children — folders never
  appear on the canvas itself
- Default icon is the URL's favicon (with a generic fallback); custom
  icons can be uploaded per bookmark/folder
- Per-bookmark label display (under the icon, or tooltip-only)
- Layout and structure changes stay in sync live across every open new-tab
  page, and across changes made in Chrome's native bookmark manager

## Tech stack

- Manifest V3 (new-tab override + background service worker)
- TypeScript (strict) + React
- Vite + [`@crxjs/vite-plugin`](https://crxjs.dev/vite-plugin)
- [`@dnd-kit`](https://dndkit.com/) for drag-and-drop
- `chrome.bookmarks` as the source of truth for structure; `chrome.storage.local`
  and IndexedDB for layout/settings/custom icons
- Vitest (unit) + Playwright (e2e, drives a real unpacked-extension load in
  Chromium)

## Getting started

To build the extension and load it into Chrome yourself, see
**[docs/local_use.md](docs/local_use.md)**.

## Documentation

| Document | Purpose |
|---|---|
| [`docs/local_use.md`](docs/local_use.md) | How to build and load this extension locally in Chrome |
| [`docs/store-listing.md`](docs/store-listing.md) | Chrome Web Store listing copy (short + detailed description) — source of truth for the published listing |
| [`SECURITY.md`](SECURITY.md) | Automated security tooling (CI + weekly scans), manual Chrome Web Store packing/signing steps, and how to protect the `.crx` signing key |
| [`openspec/project.md`](openspec/project.md) | Project description, tech stack, and the required security/development best practices this repo follows |
| [`openspec/specs/`](openspec/specs/) | The current, merged specification of every capability the extension implements |
| [`openspec/changes/`](openspec/changes/) | In-progress and archived OpenSpec change proposals (see [Folder structure](#folder-structure) below) |
| [`code-reviews/`](code-reviews/) | Point-in-time code review reports |
| [`LICENSE`](LICENSE) | MIT license |

## Folder structure

```
web-desktop/
├── src/
│   ├── background/        # MV3 service worker (bookmark event listeners, etc.)
│   ├── lib/
│   │   ├── bookmarks/      # chrome.bookmarks reads, moves, drag-resolution, URL scheme safety
│   │   ├── concurrency/    # cross-context write coordination (mutex)
│   │   ├── grid/           # grid sizing, placement, reflow, drag-drop logic
│   │   ├── icons/          # favicon resolution, custom icon upload/validation
│   │   └── storage/        # chrome.storage.local + IndexedDB persistence (positions, settings, icon blobs)
│   ├── newtab/              # the new-tab page itself
│   │   ├── components/      # Canvas, BookmarkIcon, FolderTreeNode, Sidebar, etc.
│   │   └── hooks/           # grid layout, subfolders, edge-pagination, element sizing
│   └── test/                 # shared test setup/mocks (chrome API mock, DnD test provider)
├── e2e/                    # Playwright specs — load the real unpacked extension in Chromium
├── public/                 # static assets (icons) copied into the built extension
├── security/               # gitignored: local .crx signing key + packed .crx (see SECURITY.md)
├── code-reviews/           # point-in-time code review reports
├── docs/                   # supplementary docs (this repo's local-use guide, etc.)
├── openspec/               # spec-driven change process (see below)
├── manifest.config.ts      # MV3 manifest, generated via @crxjs/vite-plugin
└── vite.config.ts          # dev server + build config
```

### `openspec/` in detail

This project tracks requirements and design decisions as specs rather than
leaving them implicit in code or PR descriptions, using the
[OpenSpec](https://github.com/Fission-AI/OpenSpec) workflow.

```
openspec/
├── project.md              # project description, tech stack, required security/dev practices
├── config.yaml              # OpenSpec tooling config
├── specs/                   # current, merged spec-of-record — one folder per capability
│   ├── bookmark-canvas/      #   grid display, navigation, sizing, pagination, positions
│   ├── bookmark-icons/       #   favicon fallback, custom icon upload/removal
│   └── folder-sidebar/       #   folder tree, selection, drag-to-reparent/move, cross-tab sync
└── changes/                  # proposals for changing the specs above
    ├── <change-name>/         #   an in-progress change: proposal.md, design.md, tasks.md, specs/ (deltas)
    └── archive/                #   changes that have been merged into specs/, kept for history
        └── <date>-<change-name>/
```

Each capability under `specs/` is the authoritative description of what
the extension currently does; each folder under `changes/` (before being
archived) proposes a delta to one or more of those specs, plus the design
rationale and task checklist for implementing it.

## License

[MIT](LICENSE)
