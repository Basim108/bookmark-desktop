# Chrome Web Store listing

Source of truth for Bookmark Desktop's Web Store copy. Paste the **Short
description** into the manifest/store summary field (it already lives in
`package.json` → `description`) and the **Detailed description** into the Chrome
Web Store dashboard's description field. Keep this file in sync when features
change.

---

## Short description (≤ 132 characters)

Turn Chrome's new tab into a desktop of your bookmarks — a customizable grid of icons with a folder sidebar.

---

## Detailed description

**Your bookmarks, as a desktop.**

Bookmark Desktop replaces Chrome's new-tab page with a clean, arrangeable
"desktop" of your bookmarks — a grid of icons you place exactly where you want,
with a folder sidebar for getting around. It's backed directly by Chrome's own
bookmarks, so there's nothing new to maintain: the bookmarks you already have
become the desktop you actually use.

**What you get**

- **A grid of bookmark icons.** Every bookmark (and the bookmarks inside its
  subfolders) shows up as an icon on an invisible grid. When a folder holds more
  than one screen's worth, the grid paginates into a simple carousel.
- **Arrange it your way.** Drag icons into the positions you want. Each icon's
  spot is remembered per folder and survives tab reloads and browser restarts.
- **A folder sidebar.** Browse your real Chrome folder tree in a sidebar and
  click a folder to show its bookmarks on the canvas. You can resize the sidebar,
  and its width is remembered.
- **Icons that fit your screen.** Icons scale smoothly as you resize the window;
  past a comfortable maximum, the grid simply adds more columns and rows instead.
- **The right picture for every link.** Each bookmark uses its site's favicon by
  default (with a clean fallback), and you can upload a custom icon for any
  bookmark or folder. Labels can sit under the icon or show only on hover.
- **Make it yours.** Set a custom background image for the canvas.
- **Always in sync.** Changes appear live across every open new-tab page — and
  they stay in step with edits you make in Chrome's own bookmark manager.
- **Bring bookmarks in.** Import folders and bookmarks from a uTab export.
- **Back up and restore everything.** Export your entire setup — bookmarks,
  layout positions, custom icons, background, and settings — to a single file,
  and import it later to restore or move to another machine.

**How it works**

Chrome's own bookmarks are the source of truth, so Bookmark Desktop reflects and
edits the bookmarks you already have. Your layout — icon positions, custom icons,
labels, background, and preferences — is stored locally in the browser, alongside
your bookmarks.

**Privacy**

Your data stays in your browser. Bookmark Desktop does not send your bookmarks or
settings anywhere; the only network requests it makes are the standard,
HTTPS-only favicon fetches Chrome uses to show site icons. It asks only for the
permissions it needs to do its job: access to your bookmarks, local storage for
your layout, and favicons for icons.
