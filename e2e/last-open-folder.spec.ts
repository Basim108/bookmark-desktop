import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

/** Chrome's own title for root folder "1" — lowercase "bar", as the sidebar renders it. */
const BOOKMARKS_BAR = "Bookmarks bar";

function newTabUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/src/newtab/index.html`;
}

/** The sidebar row owning a folder of the given name. */
function rowFor(page: Page, name: string) {
  return page
    .locator(".folder-row")
    .filter({ has: page.getByRole("button", { name, exact: true }) });
}

/** The folder currently rendered by the canvas. */
async function activeFolderId(page: Page): Promise<string | null> {
  return page.locator("[data-folder-id]").getAttribute("data-folder-id");
}

/**
 * Seeds Bookmarks Bar > Work > Rust, with one bookmark in Rust, and waits for
 * the background service worker to finish auto-placing that bookmark. The
 * worker places newly created bookmarks asynchronously, so acting before it
 * settles races a storage write that would otherwise land mid-assertion.
 */
async function seedNestedTree(page: Page) {
  const ids = await page.evaluate(async () => {
    const work = await chrome.bookmarks.create({
      parentId: "1",
      title: "LOF Work",
    });
    const rust = await chrome.bookmarks.create({
      parentId: work.id,
      title: "LOF Rust",
    });
    const doc = await chrome.bookmarks.create({
      parentId: rust.id,
      title: "LOF Doc",
      url: "https://example.com/lof-doc",
    });
    return { workId: work.id, rustId: rust.id, docId: doc.id };
  });

  await expect
    .poll(async () =>
      page.evaluate(async (rustId: string) => {
        const stored = (await chrome.storage.local.get("positions")) as {
          positions?: Record<string, Record<string, unknown>>;
        };
        return Object.keys(stored.positions?.[rustId] ?? {}).length;
      }, ids.rustId),
    )
    .toBe(1);

  return ids;
}

/** Opens Bookmarks Bar > Work in the sidebar and selects Rust. */
async function selectNestedRust(page: Page) {
  await rowFor(page, BOOKMARKS_BAR).locator(".folder-expand-toggle").click();
  await rowFor(page, "LOF Work").locator(".folder-expand-toggle").click();
  await page.getByRole("button", { name: "LOF Rust", exact: true }).click();
}

test("a new tab opens on the last selected folder with its ancestors expanded", async ({
  context,
  extensionId,
}) => {
  const pageA = await context.newPage();
  await pageA.goto(newTabUrl(extensionId));
  const { rustId } = await seedNestedTree(pageA);

  await pageA.reload();
  await selectNestedRust(pageA);
  await expect.poll(async () => activeFolderId(pageA)).toBe(rustId);

  const pageB = await context.newPage();
  await pageB.goto(newTabUrl(extensionId));

  // Restored as the active folder...
  await expect.poll(async () => activeFolderId(pageB)).toBe(rustId);
  // ...and revealed: its row is only reachable if both ancestors were expanded.
  await expect(rowFor(pageB, "LOF Rust")).toHaveClass(/folder-row--active/);
  await expect(pageB.getByText("LOF Doc")).toBeVisible();
});

test("the last opened folder survives every tab being closed", async ({
  context,
  extensionId,
}) => {
  const pageA = await context.newPage();
  await pageA.goto(newTabUrl(extensionId));
  const { rustId } = await seedNestedTree(pageA);

  await pageA.reload();
  await selectNestedRust(pageA);
  await expect.poll(async () => activeFolderId(pageA)).toBe(rustId);

  await pageA.close();

  const pageB = await context.newPage();
  await pageB.goto(newTabUrl(extensionId));
  await expect.poll(async () => activeFolderId(pageB)).toBe(rustId);
});

test("selecting a folder in one tab does not change an already-open tab", async ({
  context,
  extensionId,
}) => {
  const pageA = await context.newPage();
  await pageA.goto(newTabUrl(extensionId));
  const { rustId } = await seedNestedTree(pageA);

  await pageA.reload();
  await expect.poll(async () => activeFolderId(pageA)).toBe("1");

  // A second tab, left on Bookmarks Bar.
  const pageB = await context.newPage();
  await pageB.goto(newTabUrl(extensionId));
  await expect.poll(async () => activeFolderId(pageB)).toBe("1");

  await selectNestedRust(pageA);
  await expect.poll(async () => activeFolderId(pageA)).toBe(rustId);

  // pageB was never reloaded and must not follow pageA. Give the (deliberately
  // absent) propagation a chance to happen before asserting it did not.
  await pageB.waitForTimeout(500);
  expect(await activeFolderId(pageB)).toBe("1");
  await expect(rowFor(pageB, BOOKMARKS_BAR)).toHaveClass(/folder-row--active/);
});

test("the most recent selection across tabs is the one a new tab opens on", async ({
  context,
  extensionId,
}) => {
  const pageA = await context.newPage();
  await pageA.goto(newTabUrl(extensionId));
  const { workId, rustId } = await seedNestedTree(pageA);

  await pageA.reload();
  const pageB = await context.newPage();
  await pageB.goto(newTabUrl(extensionId));

  // First tab selects Rust, then the second selects Work — Work wins.
  await selectNestedRust(pageA);
  await expect.poll(async () => activeFolderId(pageA)).toBe(rustId);

  await rowFor(pageB, BOOKMARKS_BAR).locator(".folder-expand-toggle").click();
  await pageB.getByRole("button", { name: "LOF Work", exact: true }).click();
  await expect.poll(async () => activeFolderId(pageB)).toBe(workId);

  const pageC = await context.newPage();
  await pageC.goto(newTabUrl(extensionId));
  await expect.poll(async () => activeFolderId(pageC)).toBe(workId);
});

test("a deleted last opened folder falls back without erasing the record", async ({
  context,
  extensionId,
}) => {
  const pageA = await context.newPage();
  await pageA.goto(newTabUrl(extensionId));
  const { rustId } = await seedNestedTree(pageA);

  await pageA.reload();
  await selectNestedRust(pageA);
  await expect.poll(async () => activeFolderId(pageA)).toBe(rustId);

  await pageA.evaluate(async (id) => {
    await chrome.bookmarks.removeTree(id);
  }, rustId);

  const pageB = await context.newPage();
  await pageB.goto(newTabUrl(extensionId));

  await expect.poll(async () => activeFolderId(pageB)).toBe("1");
  // The record is left intact rather than overwritten with the fallback.
  expect(
    await pageB.evaluate(async () => {
      const stored = (await chrome.storage.local.get("lastFolderId")) as {
        lastFolderId?: string;
      };
      return stored.lastFolderId;
    }),
  ).toBe(rustId);
});
