# Chrome Web Store assets

Generated artifacts for the store listing. Both are produced from the real
extension by `capture.spec.ts`, not assembled by hand.

| File                       | Size     | Purpose                                    |
| -------------------------- | -------- | ------------------------------------------ |
| `screenshot-1280x800.png`  | 1280×800 | Listing screenshot (at least one required) |
| `promo-tile-440x280.png`   | 440×280  | Small promo tile (optional, recommended)   |

## Regenerating

```bash
npm run build        # the capture loads dist/ as an unpacked extension
npm run assets:store
```

Both files are overwritten in place. Re-run after any UI change that affects
what the screenshot shows.

## Notes

- The capture runs under its own Playwright config
  (`playwright.store-assets.config.ts`), deliberately outside the e2e suite: it
  asserts nothing and writes binary files, so running it in CI would produce
  artifacts on every run and make an asset change look like a test failure.
- Sizes come from the viewport, so no manual cropping is involved.
- Before capturing, the script visits each seeded bookmark's site to warm
  Chrome's favicon cache. A fresh headless profile has never seen those sites,
  so without this every icon renders as the generic fallback. This means the
  capture needs network access; sites that fail to load keep the fallback icon,
  which is also what a real user would see for an unvisited bookmark.
- The promo tile is a designed graphic built from the manifest's own 128px
  icon, not a shrunken UI capture — the desktop rendered at 440×280 would be an
  illegible thumbnail.
