import { test, expect } from "./fixtures";

interface StoredPositions {
  positions?: Record<string, Record<string, number>>;
}

async function readSlot(
  page: import("@playwright/test").Page,
  bookmarkId: string,
) {
  const stored = (await page.evaluate(() =>
    chrome.storage.local.get("positions"),
  )) as StoredPositions;
  return stored.positions?.["1"]?.[bookmarkId];
}

/**
 * Cells one rendered page holds, read from the DOM rather than recomputed.
 *
 * A slot carries no capacity, so which page it lands on is `slot / cellsPerPage`
 * at whatever the canvas is currently rendering. Pinning a bookmark to "page 3"
 * therefore means measuring the real grid first — a hard-coded slot would pin a
 * different page on a different viewport.
 */
async function measureCellsPerPage(
  page: import("@playwright/test").Page,
): Promise<number> {
  return page.evaluate(() => {
    const grid = document.querySelector(".canvas-grid");
    if (!grid) throw new Error("no rendered grid to measure");
    return grid.querySelectorAll(".grid-cell").length;
  });
}

/** The first slot on `pageIndex` at the currently rendered capacity. */
function firstSlotOfPage(pageIndex: number, cellsPerPage: number): number {
  return pageIndex * cellsPerPage;
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
  positions: Record<string, number>,
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

// A marker parked on the first slot of the third page keeps the folder three
// pages deep, since page count follows the highest occupied slot. The slot is
// derived from the grid the canvas actually rendered, so the pinning holds at
// whatever capacity this viewport produces.
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
  await expect(page.locator(".canvas-grid").first()).toBeVisible();
  const cellsPerPage = await measureCellsPerPage(page);
  await seedPositions(page, [draggedId, markerId], {
    [draggedId]: 0,
    [markerId]: firstSlotOfPage(2, cellsPerPage),
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
  const thirdPageSlots = (slot: number | undefined) =>
    slot === undefined ? -1 : Math.floor(slot / cellsPerPage);
  await expect
    .poll(async () => thirdPageSlots(await readSlot(page, draggedId)))
    .toBe(2);

  await page.reload();
  expect(thirdPageSlots(await readSlot(page, draggedId))).toBe(2);
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
  await expect(page.locator(".canvas-grid").first()).toBeVisible();
  const cellsPerPage = await measureCellsPerPage(page);
  const secondPageStart = firstSlotOfPage(1, cellsPerPage);
  await seedPositions(page, [draggedId, occupantId], {
    [draggedId]: 0,
    [occupantId]: secondPageStart,
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
  await expect.poll(() => readSlot(page, draggedId)).toBe(secondPageStart);
  expect(await readSlot(page, occupantId)).toBe(0);
});
