import { test, expect } from "./fixtures";

const NEWTAB = "src/newtab/index.html";

async function seed(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const sourceFolder = await chrome.bookmarks.create({
      parentId: "1",
      title: "Transfer Source",
    });
    const destinationFolder = await chrome.bookmarks.create({
      parentId: "1",
      title: "Transfer Destination",
    });
    const bookmark = await chrome.bookmarks.create({
      parentId: sourceFolder.id,
      title: "Transfer Example",
      url: "https://example.com/transfer",
    });
    await chrome.storage.local.set({
      bookmarkSettings: {
        [bookmark.id]: {
          labelDisplay: "tooltip",
          hasCustomIcon: true,
          futureColor: "violet",
        },
      },
    });
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("bookmark-desktop", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("icons");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("icons", "readwrite");
      tx.objectStore("icons").put(
        { bytes: new TextEncoder().encode("custom").buffer, type: "image/png" },
        bookmark.id,
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    return {
      sourceFolderId: sourceFolder.id,
      destinationFolderId: destinationFolder.id,
      bookmarkId: bookmark.id,
    };
  });
}

async function openSource(page: import("@playwright/test").Page) {
  await page.reload();
  const bar = page.locator(".folder-row", {
    has: page.getByRole("button", { name: "Bookmarks bar", exact: true }),
  });
  await bar.getByRole("button", { name: "Expand folder" }).click();
  await page
    .getByRole("button", { name: "Transfer Source", exact: true })
    .click();
}

test("Copy To keeps the source and copies all metadata except position", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  const ids = await seed(page);
  await openSource(page);

  await page
    .getByRole("button", { name: "Actions for Transfer Example" })
    .click();
  await page.getByRole("menuitem", { name: "Copy To..." }).click();
  const dialog = page.getByRole("dialog", {
    name: "Copy “Transfer Example” to folder",
  });
  await dialog.getByRole("button", { name: "Transfer Destination" }).click();
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(dialog).toBeHidden();

  const result = await page.evaluate(
    async ({ sourceFolderId, destinationFolderId, bookmarkId }) => {
      const source = await chrome.bookmarks.getChildren(sourceFolderId);
      const destination =
        await chrome.bookmarks.getChildren(destinationFolderId);
      const copy = destination.find(
        (node) => node.title === "Transfer Example",
      )!;
      const stored = (await chrome.storage.local.get([
        "bookmarkSettings",
        "positions",
      ])) as {
        bookmarkSettings: Record<string, Record<string, unknown>>;
        positions?: Record<string, Record<string, number>>;
      };
      const db = await new Promise<IDBDatabase>((resolve) => {
        const request = indexedDB.open("bookmark-desktop", 1);
        request.onsuccess = () => resolve(request.result);
      });
      const icon = await new Promise<unknown>((resolve) => {
        const request = db
          .transaction("icons")
          .objectStore("icons")
          .get(copy.id);
        request.onsuccess = () => resolve(request.result);
      });
      return {
        sourceIds: source.map((node) => node.id),
        copyId: copy.id,
        sourceSettings: stored.bookmarkSettings[bookmarkId],
        copySettings: stored.bookmarkSettings[copy.id],
        copyPosition: stored.positions?.[destinationFolderId]?.[copy.id],
        iconExists: Boolean(icon),
      };
    },
    ids,
  );
  expect(result.sourceIds).toContain(ids.bookmarkId);
  expect(result.copyId).not.toBe(ids.bookmarkId);
  expect(result.copySettings).toEqual(result.sourceSettings);
  expect(result.copyPosition).toBeDefined();
  expect(result.iconExists).toBe(true);
});

test("Move To preserves identity and metadata while assigning a destination position", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  const ids = await seed(page);
  await openSource(page);

  await page
    .getByRole("button", { name: "Actions for Transfer Example" })
    .click();
  await page.getByRole("menuitem", { name: "Move To..." }).click();
  const dialog = page.getByRole("dialog", {
    name: "Move “Transfer Example” to folder",
  });
  await dialog.getByRole("button", { name: "Transfer Destination" }).click();
  await dialog.getByRole("button", { name: "OK", exact: true }).click();
  await expect(dialog).toBeHidden();

  await expect
    .poll(async () =>
      page.evaluate(async ({ destinationFolderId, bookmarkId }) => {
        const destination =
          await chrome.bookmarks.getChildren(destinationFolderId);
        return destination.some((node) => node.id === bookmarkId);
      }, ids),
    )
    .toBe(true);
  const stored = await page.evaluate(
    async ({ destinationFolderId, bookmarkId }) => {
      const value = (await chrome.storage.local.get([
        "bookmarkSettings",
        "positions",
      ])) as {
        bookmarkSettings: Record<string, Record<string, unknown>>;
        positions?: Record<string, Record<string, number>>;
      };
      return {
        settings: value.bookmarkSettings[bookmarkId],
        position: value.positions?.[destinationFolderId]?.[bookmarkId],
      };
    },
    ids,
  );
  expect(stored.settings).toMatchObject({
    labelDisplay: "tooltip",
    futureColor: "violet",
  });
  expect(stored.position).toBeDefined();
});
