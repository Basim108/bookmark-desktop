import { test, expect } from "./fixtures";

test("dragging a bookmark in one tab reflects live in another open tab", async ({
  context,
  extensionId,
}) => {
  const pageA = await context.newPage();
  await pageA.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const [firstId, secondId] = await pageA.evaluate(async () => {
    const a = await chrome.bookmarks.create({
      parentId: "1",
      title: "Sync Drag A",
      url: "https://example.com/sync-a",
    });
    const b = await chrome.bookmarks.create({
      parentId: "1",
      title: "Sync Drag B",
      url: "https://example.com/sync-b",
    });
    return [a.id, b.id];
  });

  await pageA.reload();
  const pageB = await context.newPage();
  await pageB.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const iconA = pageA.getByText("Sync Drag A");
  const iconB = pageA.getByText("Sync Drag B");
  await expect(iconA).toBeVisible();
  await expect(iconB).toBeVisible();

  const boxA = await iconA.boundingBox();
  const boxB = await iconB.boundingBox();
  if (!boxA || !boxB) throw new Error("Could not measure bookmark icons");

  await pageA.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
  await pageA.mouse.down();
  await pageA.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2, {
    steps: 10,
  });
  await pageA.mouse.up();

  // pageB was never reloaded — this only passes if chrome.storage.onChanged
  // propagated the swap live.
  await expect
    .poll(async () => {
      const stored = (await pageB.evaluate(() =>
        chrome.storage.local.get("positions"),
      )) as {
        positions?: Record<
          string,
          Record<string, { page: number; row: number; col: number }>
        >;
      };
      const folderPositions = stored.positions?.["1"];
      return {
        a: folderPositions?.[firstId],
        b: folderPositions?.[secondId],
      };
    })
    .toEqual({
      a: { page: 0, row: 0, col: 1 },
      b: { page: 0, row: 0, col: 0 },
    });
});

test("a bookmark created via the bookmarks API appears live in an already-open tab", async ({
  context,
  extensionId,
}) => {
  const pageA = await context.newPage();
  await pageA.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);
  await expect(pageA.locator(".canvas")).toBeVisible();

  // Simulates a bookmark created from another surface (another open new-tab
  // page, or Chrome's native bookmark manager) — not any action in pageA.
  await pageA.evaluate(async () => {
    await chrome.bookmarks.create({
      parentId: "1",
      title: "Live Structure Sync Bookmark",
      url: "https://example.com/live-structure-sync",
    });
  });

  // pageA was never reloaded.
  await expect(pageA.getByText("Live Structure Sync Bookmark")).toBeVisible();
});
