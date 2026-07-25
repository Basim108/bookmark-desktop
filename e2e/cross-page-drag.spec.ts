import { test, expect } from "./fixtures";

interface StoredPositions {
  positions?: Record<
    string,
    Record<string, { page: number; row: number; col: number }>
  >;
}

async function readPosition(
  page: import("@playwright/test").Page,
  bookmarkId: string,
) {
  const stored = (await page.evaluate(() =>
    chrome.storage.local.get("positions"),
  )) as StoredPositions;
  return stored.positions?.["1"]?.[bookmarkId];
}

// The background service worker auto-places every newly created bookmark
// (onCreated -> placeNewBookmark) asynchronously and outside any coordination
// with this test. If we overwrite positions before those writes land, a late
// SW placement clobbers our seeded layout back onto page 0 — collapsing the
// multi-page folder these tests depend on. Under a loaded CI runner the SW
// loses the race often enough to fail deterministically. So: create the
// bookmarks, wait until the SW has placed all of them (no writes left
// pending), and only then apply the explicit positions as the final write.
async function seedPositions(
  page: import("@playwright/test").Page,
  bookmarkIds: string[],
  positions: Record<string, { page: number; row: number; col: number }>,
) {
  await page.evaluate(async (ids) => {
    const allPlaced = async () => {
      const stored = (await chrome.storage.local.get("positions")) as {
        positions?: Record<string, Record<string, unknown>>;
      };
      const folder = stored.positions?.["1"] ?? {};
      return ids.every((id) => id in folder);
    };
    while (!(await allPlaced())) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }, bookmarkIds);

  await page.evaluate(async (folderPositions) => {
    await chrome.storage.local.set({ positions: { "1": folderPositions } });
  }, positions);
}

// Injected positions pin an exact page count independent of viewport/capacity:
// paginate() keys fitting items by their stored page and never compacts them
// forward, so a marker parked on page 3 keeps the folder three pages deep even
// with empty cells before it.
test("drags a bookmark across multiple pages in one continuous drag", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const { draggedId, markerId } = await page.evaluate(async () => {
    const a = await chrome.bookmarks.create({
      parentId: "1",
      title: "Cross Drag A",
      url: "https://example.com/cross-a",
    });
    const marker = await chrome.bookmarks.create({
      parentId: "1",
      title: "Third Page Marker",
      url: "https://example.com/marker",
    });
    return { draggedId: a.id, markerId: marker.id };
  });
  await seedPositions(page, [draggedId, markerId], {
    [draggedId]: { page: 0, row: 0, col: 0 },
    [markerId]: { page: 2, row: 0, col: 0 },
  });
  await page.reload();

  const icon = page.getByText("Cross Drag A");
  await expect(icon).toBeVisible();
  await expect(page.getByText(/Page 1 of 3/)).toBeVisible();

  const canvasBox = await page.locator(".canvas").boundingBox();
  const iconBox = await icon.boundingBox();
  if (!canvasBox || !iconBox) throw new Error("Could not measure elements");

  // Grab the icon and hold it at the right edge; the auto-advance keeps paging
  // (0 -> 1 -> 2) while held, so a single drag reaches the third page.
  await page.mouse.move(
    iconBox.x + iconBox.width / 2,
    iconBox.y + iconBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width - 10, iconBox.y, {
    steps: 10,
  });
  await expect(page.getByText(/Page 3 of 3/)).toBeVisible({ timeout: 3000 });

  // Pull back to an empty cell near the centre of the third page and drop.
  await page.mouse.move(
    canvasBox.x + canvasBox.width / 2,
    canvasBox.y + canvasBox.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();

  // The dragged bookmark persisted onto the third page (index 2) — it did not
  // revert to its origin page when the page flipped mid-drag.
  await expect
    .poll(() => readPosition(page, draggedId))
    .toMatchObject({ page: 2 });

  await page.reload();
  expect((await readPosition(page, draggedId))?.page).toBe(2);
});

test("cross-page swap sends the displaced bookmark to the origin page", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const { draggedId, occupantId } = await page.evaluate(async () => {
    const a = await chrome.bookmarks.create({
      parentId: "1",
      title: "Swap Source",
      url: "https://example.com/swap-a",
    });
    const b = await chrome.bookmarks.create({
      parentId: "1",
      title: "Swap Target",
      url: "https://example.com/swap-b",
    });
    return { draggedId: a.id, occupantId: b.id };
  });
  await seedPositions(page, [draggedId, occupantId], {
    [draggedId]: { page: 0, row: 0, col: 0 },
    [occupantId]: { page: 1, row: 0, col: 0 },
  });
  await page.reload();

  const source = page.getByText("Swap Source");
  await expect(source).toBeVisible();
  await expect(page.getByText(/Page 1 of 2/)).toBeVisible();

  const canvasBox = await page.locator(".canvas").boundingBox();
  const sourceBox = await source.boundingBox();
  if (!canvasBox || !sourceBox) throw new Error("Could not measure elements");

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width - 10, sourceBox.y, {
    steps: 10,
  });
  // Auto-advance to the second page, where the target now becomes visible.
  await expect(page.getByText(/Page 2 of 2/)).toBeVisible({ timeout: 3000 });

  const targetIcon = page.getByText("Swap Target");
  await expect(targetIcon).toBeVisible();
  const targetBox = await targetIcon.boundingBox();
  if (!targetBox) throw new Error("Could not measure the swap target");

  // Drop onto the target's cell on the second page.
  await page.mouse.move(
    targetBox.x + targetBox.width / 2,
    targetBox.y + targetBox.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();

  // Dragged bookmark takes the second-page cell; the displaced occupant moves
  // back to the dragged bookmark's original first-page cell.
  await expect
    .poll(() => readPosition(page, draggedId))
    .toEqual({ page: 1, row: 0, col: 0 });
  expect(await readPosition(page, occupantId)).toEqual({
    page: 0,
    row: 0,
    col: 0,
  });
});
