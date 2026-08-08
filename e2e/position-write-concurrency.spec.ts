import { test, expect } from "./fixtures";

/**
 * Stored positions live under one `chrome.storage.local` key and are updated by
 * read-modify-write from two independent JS contexts: the background service
 * worker (per-item `placeNewBookmark` on `onCreated`) and the newtab page
 * (whole-map writes from backfill, migration and drag). The SW's in-process mutex
 * cannot serialize the page, so without cross-context locking a page write
 * built from a stale snapshot silently drops placements the SW committed in
 * between — leaving bookmarks that exist in Chrome but never appear on the
 * canvas.
 *
 * The window is real, not theoretical: the uTab importer creates bookmarks in
 * bulk from the page while the SW places each one.
 */

interface StoredPositions {
  positions?: Record<string, Record<string, unknown>>;
}

/** Creates `count` bookmarks in the Bookmarks Bar from the *page* context. */
async function createFromPage(
  page: import("@playwright/test").Page,
  count: number,
): Promise<string[]> {
  return page.evaluate(async (n) => {
    const created: string[] = [];
    for (let i = 0; i < n; i++) {
      const node = await chrome.bookmarks.create({
        parentId: "1",
        title: `Concurrent ${String(i).padStart(2, "0")}`,
        url: `https://example.com/concurrent-${i}`,
      });
      created.push(node.id);
    }
    return created;
  }, count);
}

async function readFolderPositionIds(
  page: import("@playwright/test").Page,
): Promise<string[]> {
  const stored = (await page.evaluate(() =>
    chrome.storage.local.get("positions"),
  )) as StoredPositions;
  return Object.keys(stored.positions?.["1"] ?? {});
}

test("every bookmark created during the page's initial backfill keeps a stored position", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });

  // Deliberately do NOT settle the page first: creating while the newtab's
  // first backfillFolderPositions is still in flight is what puts a page-side
  // whole-map write in flight against the SW's per-item placements.
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);
  const ids = await createFromPage(page, 40);

  // Placement writes settle quickly; poll until the count stops rising so a
  // slow runner doesn't read a still-filling map.
  let previous = -1;
  await expect
    .poll(
      async () => {
        const current = (await readFolderPositionIds(page)).length;
        const settled = current === previous && current > 0;
        previous = current;
        return settled;
      },
      { timeout: 15000, intervals: [250] },
    )
    .toBe(true);

  const stored = await readFolderPositionIds(page);
  const missing = ids.filter((id) => !stored.includes(id));
  expect(missing).toEqual([]);
});

test("a page-side write does not drop placements made in another folder", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  // setFolderPositions rewrites the whole positions map, not just its own
  // folder's slice, so a stale write can strand another folder's entries too.
  const other = await page.evaluate(async () => {
    const folder = await chrome.bookmarks.create({
      parentId: "1",
      title: "Other Folder",
    });
    const created: string[] = [];
    for (let i = 0; i < 20; i++) {
      const node = await chrome.bookmarks.create({
        parentId: folder.id,
        title: `Other ${i}`,
        url: `https://example.com/other-${i}`,
      });
      created.push(node.id);
    }
    return { folderId: folder.id, ids: created };
  });

  const barIds = await createFromPage(page, 20);

  await expect
    .poll(
      async () => {
        const stored = (await page.evaluate(() =>
          chrome.storage.local.get("positions"),
        )) as StoredPositions;
        const bar = Object.keys(stored.positions?.["1"] ?? {});
        const nested = Object.keys(stored.positions?.[other.folderId] ?? {});
        return (
          barIds.every((id) => bar.includes(id)) &&
          other.ids.every((id) => nested.includes(id))
        );
      },
      { timeout: 15000, intervals: [250] },
    )
    .toBe(true);
});
