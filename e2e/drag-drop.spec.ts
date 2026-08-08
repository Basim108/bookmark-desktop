import { test, expect } from "./fixtures";

interface StoredPositions {
  positions?: Record<string, Record<string, number>>;
}

test("dragging a bookmark onto another swaps their stored positions", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  // Seed two bookmarks directly in the real Bookmarks Bar (id "1").
  const [firstId, secondId] = await page.evaluate(async () => {
    const a = await chrome.bookmarks.create({
      parentId: "1",
      title: "Drag Test A",
      url: "https://example.com/a",
    });
    const b = await chrome.bookmarks.create({
      parentId: "1",
      title: "Drag Test B",
      url: "https://example.com/b",
    });
    return [a.id, b.id];
  });

  await page.reload();

  const iconA = page.getByText("Drag Test A");
  const iconB = page.getByText("Drag Test B");
  await expect(iconA).toBeVisible();
  await expect(iconB).toBeVisible();

  const boxA = await iconA.boundingBox();
  const boxB = await iconB.boundingBox();
  if (!boxA || !boxB) throw new Error("Could not measure bookmark icons");

  await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + boxA.height / 2);
  await page.mouse.down();
  await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + boxB.height / 2, {
    steps: 10,
  });
  await page.mouse.up();

  await expect
    .poll(async () => {
      const stored = (await page.evaluate(() =>
        chrome.storage.local.get("positions"),
      )) as StoredPositions;
      const folderPositions = stored.positions?.["1"];
      return {
        a: folderPositions?.[firstId],
        b: folderPositions?.[secondId],
      };
    })
    // A swap exchanges the two bookmarks' slots: the dragged one takes the
    // occupant's, and the occupant takes the dragged one's.
    .toEqual({ a: 1, b: 0 });

  // Reload to confirm the swap actually persisted, not just in-memory state.
  await page.reload();
  const iconAAfterReload = page.getByText("Drag Test A");
  const iconBAfterReload = page.getByText("Drag Test B");
  const boxAAfter = await iconAAfterReload.boundingBox();
  const boxBAfter = await iconBAfterReload.boundingBox();
  expect(boxAAfter?.x).toBeGreaterThan(boxBAfter?.x ?? Infinity);
});
