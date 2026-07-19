# Chrome Web Store assets

Generated artifacts for the store listing. All three are produced from the real
extension by `capture.spec.ts`, not assembled by hand.

| File                      | Size     | Purpose                                    |
| ------------------------- | -------- | ------------------------------------------ |
| `screenshot-1280x800.png` | 1280×800 | Listing screenshot (at least one required) |
| `promo-tile-440x280.png`  | 440×280  | Small promo tile (optional, recommended)   |
| `marquee-1400x560.png`    | 1400×560 | Marquee promo tile (featured placements)   |

## Regenerating

```bash
npm run build        # the capture loads dist/ as an unpacked extension
npm run assets:store
```

All three files are overwritten in place. Re-run after any UI change that
affects what the screenshots show.

## Notes

- The capture runs under its own Playwright config
  (`playwright.store-assets.config.ts`), deliberately outside the e2e suite: it
  asserts nothing and writes binary files, so running it in CI would produce
  artifacts on every run and make an asset change look like a test failure.
- Sizes come from the viewport, so no manual cropping is involved.
- **Regenerate on an unrestricted network.** Before capturing, the script visits
  each seeded bookmark's site to warm Chrome's favicon cache. A fresh headless
  profile has never seen those sites, so without this every icon renders as the
  generic fallback. Sites that fail to load keep the fallback globe — harmless
  in a sandboxed or offline run, but it makes the published assets look worse
  than the product does, so check the output before uploading.
- **The store rejects images with an alpha channel** (JPEG or 24-bit PNG only).
  Chromium already writes colortype 2 — 24-bit RGB, no alpha — for a fully
  opaque page, so no conversion step is needed. The one way this regresses is a
  composition that leaves a transparent gap, which is why the tile layouts set
  an opaque background on `body`. To check an asset:

  ```bash
  python3 -c "import struct;d=open('marquee-1400x560.png','rb').read();print(struct.unpack('>IIBB',d[16:26]))"
  # -> (width, height, 8, 2)   colortype 2 = 24-bit RGB, no alpha
  ```

- The 440×280 promo tile is a designed graphic built from the manifest's own
  128px icon, not a shrunken UI capture — the desktop rendered that small would
  be an illegible thumbnail.
- The 1400×560 marquee is a split layout: the wordmark on the left, the real
  desktop bleeding off the right edge. At 2.5:1 the small tile's centered lockup
  would leave the frame mostly empty, and the marquee is what the store's
  featured placements show, so it needs to show the product. The embedded
  desktop is captured at exactly the size it is displayed at, so it renders 1:1
  — no upscale blur and no crop through a row of icons.
