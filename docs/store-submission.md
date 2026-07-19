# Chrome Web Store submission — dashboard answers

Paste-ready answers for the fields the Developer Dashboard asks for at
submission time. Listing copy itself lives in `store-listing.md`; this file
covers everything else. Keep both in sync when behavior changes.

## Privacy policy URL

Publish `PRIVACY.md` at a stable public URL and enter it here.

- [ ] URL: _(to be filled once hosted — see the note at the bottom)_

## Data-use disclosures

The extension collects nothing and transfers nothing, so every category is
answered "no".

| Question                                                    | Answer |
| ----------------------------------------------------------- | ------ |
| Does this item collect personally identifiable information? | No     |
| Health information?                                         | No     |
| Financial and payment information?                          | No     |
| Authentication information?                                 | No     |
| Personal communications?                                    | No     |
| Location?                                                   | No     |
| Web history?                                                | No     |
| User activity (clicks, mouse position, scroll, keystrokes)? | No     |
| Website content (text, images, sound, files)?               | No     |

Then affirm all three certifications:

- I do not sell or transfer user data to third parties, outside of the approved
  use cases.
- I do not use or transfer user data for purposes unrelated to my item's single
  purpose.
- I do not use or transfer user data to determine creditworthiness or for
  lending purposes.

All three are true: no data leaves the device.

## Single purpose

> Bookmark Desktop replaces Chrome's new-tab page with a customizable desktop of
> the user's existing bookmarks — a grid of icons with a folder sidebar.

Every permission below serves that one purpose.

## Permission justifications

**`bookmarks`**

> The extension's entire purpose is to display the user's bookmarks as an icon
> desktop, so it reads the bookmark tree to render it, and writes to it when the
> user adds, renames, moves, or deletes a bookmark from within the extension.

**`storage`**

> Stores the user's icon layout (which page, row, and column each bookmark
> occupies), their display settings, and any custom icons or background image
> they upload — all locally on the device.

**`favicon`**

> Displays each bookmark's site icon on the desktop grid, using Chrome's own
> favicon service rather than contacting sites directly.

No host permissions are requested, so the extension cannot read the content of
any web page.

## Expected install warnings

Chrome will show these at install; the listing copy already explains both, which
helps review go smoothly:

- "Replace the page you see when opening a new tab" — this is the extension's
  stated purpose, covered in the listing's opening line.
- "Read and change your bookmarks" — covered by the listing's privacy paragraph
  and the `bookmarks` justification above.

## Assets and package

- Screenshot (1280×800) and promo tile (440×280): `store-assets/` — regenerate
  with `npm run build && npm run assets:store`.
- Upload `dist/` as a zip, or a packed `.crx`. Follow `SECURITY.md` for signing
  key handling: move the `.pem` to a vault immediately after packing, and never
  commit it.

## Open decision: where to host the privacy policy

The dashboard needs a URL that stays stable across releases. Two workable
options:

1. **GitHub Pages** — enable Pages on the repo and publish `PRIVACY.md`; gives a
   clean URL like `https://basim108.github.io/bookmark-desktop/privacy`.
2. **Rendered repo markdown** — link
   `https://github.com/Basim108/bookmark-desktop/blob/main/PRIVACY.md` directly.
   Zero setup, and acceptable to reviewers, but the URL is branch-coupled.

Option 2 is enough to submit; option 1 reads better on the listing.
