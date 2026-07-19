import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "../e2e/fixtures";

/*
 * Generates the Chrome Web Store visual assets from the real extension.
 *
 * Not part of the e2e suite: this asserts nothing and writes binary files, so
 * running it in CI would produce artifacts on every run and make an asset
 * change look like a test failure. Run it deliberately:
 *
 *   npm run build && npm run assets:store
 *
 * Sizes come out of the viewport rather than a post-crop, so re-running after a
 * UI change yields correctly sized assets with no manual step.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = __dirname;
const NEWTAB = "src/newtab/index.html";

/** Chrome Web Store screenshot size. */
const SCREENSHOT = { width: 1280, height: 800 };
/** Chrome Web Store small promo tile size. */
const PROMO_TILE = { width: 440, height: 280 };

/**
 * Representative content for the screenshots — a store screenshot showing an
 * empty desktop tells a prospective user nothing about what the extension does.
 */
async function seedDesktop(
  page: import("@playwright/test").Page,
): Promise<string[]> {
  return page.evaluate(async () => {
    // Start from a clean bar so re-runs don't stack duplicates.
    const [bar] = await chrome.bookmarks.getSubTree("1");
    for (const child of bar?.children ?? []) {
      await chrome.bookmarks.removeTree(child.id);
    }

    const folders: Record<string, [string, string][]> = {
      Reading: [
        ["Hacker News", "https://news.ycombinator.com"],
        ["Ars Technica", "https://arstechnica.com"],
        ["The Verge", "https://www.theverge.com"],
        ["Wikipedia", "https://www.wikipedia.org"],
      ],
      // The folder the screenshot opens on — enough items to show the grid
      // filling the canvas rather than one sparse row.
      Work: [
        ["GitHub", "https://github.com"],
        ["MDN Web Docs", "https://developer.mozilla.org"],
        ["Figma", "https://www.figma.com"],
        ["Linear", "https://linear.app"],
        ["Notion", "https://www.notion.so"],
        ["Slack", "https://slack.com"],
        ["Vercel", "https://vercel.com"],
        ["Cloudflare", "https://www.cloudflare.com"],
        ["npm", "https://www.npmjs.com"],
        ["TypeScript", "https://www.typescriptlang.org"],
        ["React", "https://react.dev"],
        ["Vite", "https://vite.dev"],
        ["Playwright", "https://playwright.dev"],
        ["Docker", "https://www.docker.com"],
        ["Postman", "https://www.postman.com"],
      ],
      Media: [
        ["YouTube", "https://www.youtube.com"],
        ["Spotify", "https://open.spotify.com"],
        ["Netflix", "https://www.netflix.com"],
      ],
    };

    const urls: string[] = [];
    for (const [title, bookmarks] of Object.entries(folders)) {
      const folder = await chrome.bookmarks.create({
        parentId: "1",
        title,
      });
      for (const [name, url] of bookmarks) {
        await chrome.bookmarks.create({
          parentId: folder.id,
          title: name,
          url,
        });
        urls.push(url);
      }
    }
    return urls;
  });
}

/**
 * Visits each seeded site so Chrome populates the favicon cache the `_favicon`
 * API reads from. Without this the capture is all fallback globes: a fresh
 * headless profile has never seen these sites, whereas a real user's profile
 * has. Best-effort — a site that fails to load just keeps its fallback icon.
 */
async function warmFaviconCache(
  context: import("@playwright/test").BrowserContext,
  urls: string[],
) {
  const page = await context.newPage();
  for (const url of urls) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15_000 });
      await page.waitForTimeout(400);
    } catch {
      // Offline or slow site — fall back to the generic icon for this one.
    }
  }
  await page.close();
}

test("captures the 1280x800 store screenshot", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize(SCREENSHOT);
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  const seededUrls = await seedDesktop(page);
  await warmFaviconCache(context, seededUrls);

  // Reload so the seeded tree renders, then open a populated folder.
  await page.reload();
  const barRow = page.locator(".folder-row", {
    has: page.getByRole("button", { name: "Bookmarks bar", exact: true }),
  });
  await barRow.getByRole("button", { name: "Expand folder" }).click();
  await page.getByRole("button", { name: "Work", exact: true }).click();
  await page.waitForTimeout(1000); // let favicons settle

  await page.screenshot({
    path: path.join(OUT_DIR, "screenshot-1280x800.png"),
  });
});

test("captures the 440x280 promo tile", async ({ context, extensionId }) => {
  // A promo tile is a designed graphic, not a shrunken UI capture — the desktop
  // rendered at 440x280 would be an illegible thumbnail. Built from the same
  // icon the manifest ships so the tile and the installed extension match.
  const iconPath = path.join(
    __dirname,
    "..",
    "public",
    "icons",
    "icon-128.png",
  );
  const iconDataUrl = `data:image/png;base64,${(await readFile(iconPath)).toString("base64")}`;

  const page = await context.newPage();
  await page.setViewportSize(PROMO_TILE);
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await page.setContent(`
    <style>
      html, body { margin: 0; padding: 0; }
      body {
        width: ${PROMO_TILE.width}px;
        height: ${PROMO_TILE.height}px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        background: linear-gradient(140deg, #1f2937 0%, #111827 100%);
        color: #f9fafb;
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        text-align: center;
      }
      img { width: 84px; height: 84px; }
      h1 { margin: 0; font-size: 30px; font-weight: 650; letter-spacing: -0.02em; }
      p { margin: 0; font-size: 15px; color: #9ca3af; max-width: 340px; line-height: 1.4; }
    </style>
    <img src="${iconDataUrl}" alt="" />
    <h1>Bookmark Desktop</h1>
    <p>Your new tab, as a desktop of bookmark icons.</p>
  `);

  await page.screenshot({
    path: path.join(OUT_DIR, "promo-tile-440x280.png"),
  });
});
