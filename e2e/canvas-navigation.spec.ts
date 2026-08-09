import { test, expect } from "./fixtures";

test("selecting a folder in the sidebar filters the canvas to that folder's bookmarks", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  await page.evaluate(async () => {
    const folderA = await chrome.bookmarks.create({
      parentId: "1",
      title: "Filter Folder A",
    });
    const folderB = await chrome.bookmarks.create({
      parentId: "1",
      title: "Filter Folder B",
    });
    await chrome.bookmarks.create({
      parentId: folderA.id,
      title: "Only In A",
      url: "https://example.com/only-in-a",
    });
    await chrome.bookmarks.create({
      parentId: folderB.id,
      title: "Only In B",
      url: "https://example.com/only-in-b",
    });
  });
  await page.reload();

  const bookmarksBarRow = page.locator(".folder-row", {
    has: page.getByRole("button", { name: "Bookmarks bar", exact: true }),
  });
  await bookmarksBarRow.getByRole("button", { name: "Expand folder" }).click();

  const folderAButton = page.getByRole("button", {
    name: "Filter Folder A",
    exact: true,
  });
  const folderBButton = page.getByRole("button", {
    name: "Filter Folder B",
    exact: true,
  });

  await folderAButton.click();
  await expect(page.getByText("Only In A")).toBeVisible();
  await expect(page.getByText("Only In B")).not.toBeVisible();

  await folderBButton.click();
  await expect(page.getByText("Only In B")).toBeVisible();
  await expect(page.getByText("Only In A")).not.toBeVisible();
});

test("clicking a bookmark icon navigates the current tab to its URL", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  await page.evaluate(async () => {
    await chrome.bookmarks.create({
      parentId: "1",
      title: "Click Nav Bookmark",
      url: "https://example.com/click-nav-test",
    });
  });
  await page.reload();

  await page.getByText("Click Nav Bookmark").click();

  await page.waitForURL("https://example.com/click-nav-test");
});

test("horizontal wheel input over the canvas turns pages", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  // Enough bookmarks to guarantee more than one page regardless of the
  // runner's viewport, matching the edge-pagination spec's approach.
  await page.evaluate(async () => {
    for (let i = 0; i < 40; i++) {
      await chrome.bookmarks.create({
        parentId: "1",
        title: `Wheel Test ${i}`,
        url: `https://example.com/wheel-${i}`,
      });
    }
  });
  await page.reload();

  await expect(page.getByText("Wheel Test 0")).toBeVisible();
  await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();

  const canvas = page.locator(".canvas");
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error("Could not measure the canvas");
  await page.mouse.move(
    canvasBox.x + canvasBox.width / 2,
    canvasBox.y + canvasBox.height / 2,
  );

  await page.mouse.wheel(120, 0);
  await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();

  // The extension page must still be the one displayed: an unprevented
  // horizontal wheel over a non-scrolling area is what feeds Chrome's
  // back/forward gesture. (The authoritative guard is the defaultPrevented
  // assertion in Canvas.test.tsx — synthetic wheel events do not reliably
  // reproduce the real trackpad gesture — so this is a smoke check.)
  expect(page.url()).toContain("/src/newtab/index.html");

  // The cooldown is deliberately direction-agnostic: it is a rate limit, and
  // exempting reversals would let a trackpad's directional jitter oscillate
  // pages. So a reversal within the cooldown is clamped rather than turning —
  // wait it out before checking that reversing works at all.
  await page.waitForTimeout(300);

  // Reversing turns back, and the page-1 content is live again.
  await page.mouse.wheel(-120, 0);
  await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();
  await expect(page.getByText("Wheel Test 0")).toBeVisible();
});

test("wheel input does not turn pages while a bookmark is being dragged", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  await page.evaluate(async () => {
    for (let i = 0; i < 40; i++) {
      await chrome.bookmarks.create({
        parentId: "1",
        title: `Wheel Drag ${i}`,
        url: `https://example.com/wheel-drag-${i}`,
      });
    }
  });
  await page.reload();

  await expect(page.getByText("Wheel Drag 0")).toBeVisible();
  await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();

  const canvas = page.locator(".canvas");
  const canvasBox = await canvas.boundingBox();
  const iconBox = await page.getByText("Wheel Drag 0").boundingBox();
  if (!canvasBox || !iconBox) throw new Error("Could not measure elements");

  await page.mouse.move(
    iconBox.x + iconBox.width / 2,
    iconBox.y + iconBox.height / 2,
  );
  await page.mouse.down();
  // Hold in the middle of the canvas, well clear of the edges, so drag-to-edge
  // auto-advance cannot be what turns (or fails to turn) the page.
  await page.mouse.move(
    canvasBox.x + canvasBox.width / 2,
    canvasBox.y + canvasBox.height / 2,
    { steps: 10 },
  );

  await page.mouse.wheel(400, 0);
  // Deliberately generous: the assertion is that nothing happens, so it needs
  // long enough that a page turn would have landed had the gate been missing.
  await page.waitForTimeout(500);
  await expect(page.getByText(/Page 1 of \d+/)).toBeVisible();

  await page.mouse.up();

  // Once the drag ends the wheel takes effect again, proving the suppression
  // is scoped to the drag rather than permanent.
  await page.mouse.wheel(120, 0);
  await expect(page.getByText(/Page 2 of \d+/)).toBeVisible();
});
