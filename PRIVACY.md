# Privacy Policy — Bookmark Desktop

**Last updated: 19 July 2026**

Bookmark Desktop is a Chrome extension that replaces your new-tab page with a
desktop of your bookmarks. This policy describes what it does with your data.

## The short version

Bookmark Desktop does not collect, transmit, or sell your data. Everything it
stores stays on your device, in your browser. There is no account, no server,
and no analytics.

## What the extension handles

To do its job, the extension reads and stores:

- **Your bookmarks** — titles, URLs, and folder structure, read through
  Chrome's bookmarks API. Chrome remains the owner of this data; the extension
  reads it to draw your desktop and writes to it when you add, edit, move, or
  delete a bookmark from within the extension.
- **Layout data** — which page, row, and column each bookmark icon occupies,
  and your sidebar width.
- **Settings** — per-bookmark and per-folder display preferences, and your
  canvas background choice.
- **Images you upload** — custom icons for bookmarks and folders, and a canvas
  background image, if you choose to set them.

## Where it is stored

All of it is stored locally on your device, using the browser's own storage:
`chrome.storage.local` for layout and settings, and IndexedDB for uploaded
images. None of it leaves your device. The extension has no backend server and
sends no data anywhere.

If you use the export feature, the extension writes a backup file to your
computer through Chrome's normal download flow. That file contains your
bookmarks, layout, settings, and uploaded images. It is written to your device
and is never uploaded anywhere — what you do with it afterwards is up to you.

## Network requests

The extension makes no network requests of its own.

Site icons are requested through Chrome's built-in `_favicon` API. The extension
asks Chrome for the icon belonging to a bookmark's URL, and Chrome serves it
from the favicon cache it already maintains for your browsing. Any network
fetch involved is Chrome's own, made the same way it is when the site appears in
your bookmarks bar or history. The extension never contacts a site directly and
never sends your bookmark data to anyone.

## Permissions and why they are needed

| Permission  | Why                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| `bookmarks` | To read your bookmarks and folders to draw the desktop, and to apply edits you make in the extension. |
| `storage`   | To save your icon layout, settings, and uploaded images locally.                                      |
| `favicon`   | To display each bookmark's site icon via Chrome's favicon service.                                    |

The extension requests no host permissions, so it has no access to the content
of any web page you visit.

## Data sharing

None. No data is sold, shared, or transferred to any third party, and none is
used for advertising, profiling, or any purpose unrelated to displaying your
bookmark desktop.

## Children's privacy

The extension collects no personal information from anyone, including children.

## Changes to this policy

If this policy changes, the "last updated" date above will change with it, and
the revision history is public in the extension's repository.

## Contact

Questions about this policy can be raised as an issue at
<https://github.com/Basim108/bookmark-desktop/issues>.
