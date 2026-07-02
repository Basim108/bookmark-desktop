import type { Locator } from "@playwright/test";
import { test, expect } from "./fixtures";

interface StoredPositions {
  positions?: Record<
    string,
    Record<string, { page: number; row: number; col: number }>
  >;
}

async function dragBetween(
  page: import("@playwright/test").Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

/**
 * Clicks `trigger` and waits for `target` to appear, retrying the click if
 * it doesn't. Guards against a rare click-vs-React-render race right after
 * a drag: Playwright's actionability check and a React state update (e.g.
 * a sidebar row's "has children" flipping true right as it's clicked) can
 * land in the same tick, so the click registers but has no effect. Safe to
 * retry here since both call sites either re-select an already-selected
 * folder (idempotent) or re-click a still-collapsed expand toggle.
 */
async function clickUntilVisible(trigger: Locator, target: Locator) {
  await expect(async () => {
    await trigger.click();
    await expect(target).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 10_000 });
}

test("dragging a bookmark onto a sidebar folder moves it there", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const { folderBId, bookmarkId } = await page.evaluate(async () => {
    const folderA = await chrome.bookmarks.create({
      parentId: "1",
      title: "Cross Drag Folder A",
    });
    const folderB = await chrome.bookmarks.create({
      parentId: "1",
      title: "Cross Drag Folder B",
    });
    const bookmark = await chrome.bookmarks.create({
      parentId: folderA.id,
      title: "Cross Drag Bookmark",
      url: "https://example.com/cross-drag",
    });
    return {
      folderBId: folderB.id,
      bookmarkId: bookmark.id,
    };
  });

  await page.reload();

  // Expand the Bookmarks Bar row so both new folders are visible as sidebar rows.
  const bookmarksBarRow = page.locator(".folder-row", {
    has: page.getByRole("button", { name: "Bookmarks bar", exact: true }),
  });
  await bookmarksBarRow.getByRole("button", { name: "Expand folder" }).click();

  const folderAButton = page.getByRole("button", {
    name: "Cross Drag Folder A",
    exact: true,
  });
  const folderBButton = page.getByRole("button", {
    name: "Cross Drag Folder B",
    exact: true,
  });
  await expect(folderAButton).toBeVisible();
  await expect(folderBButton).toBeVisible();

  // Select folder A so its canvas (containing the bookmark) is active.
  await folderAButton.click();
  const bookmarkIcon = page.getByText("Cross Drag Bookmark");
  await expect(bookmarkIcon).toBeVisible();

  const iconBox = await bookmarkIcon.boundingBox();
  const targetBox = await folderBButton.boundingBox();
  if (!iconBox || !targetBox) throw new Error("Could not measure elements");

  await dragBetween(
    page,
    { x: iconBox.x + iconBox.width / 2, y: iconBox.y + iconBox.height / 2 },
    {
      x: targetBox.x + targetBox.width / 2,
      y: targetBox.y + targetBox.height / 2,
    },
  );

  // Same-tab optimistic update: it disappears from folder A's canvas immediately.
  await expect(bookmarkIcon).not.toBeVisible();

  // The bookmarks API move actually happened.
  await expect
    .poll(async () => {
      const [node] = await page.evaluate(
        (id) => chrome.bookmarks.get(id),
        bookmarkId,
      );
      return node?.parentId;
    })
    .toBe(folderBId);

  // It was placed in folder B's next free cell.
  await expect
    .poll(async () => {
      const stored = (await page.evaluate(() =>
        chrome.storage.local.get("positions"),
      )) as StoredPositions;
      return stored.positions?.[folderBId]?.[bookmarkId];
    })
    .toEqual({ page: 0, row: 0, col: 0 });

  // Navigating to folder B shows the bookmark there.
  await clickUntilVisible(folderBButton, page.getByText("Cross Drag Bookmark"));
});

test("dragging a folder row onto another folder row reparents it", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const { folderCId, folderDId } = await page.evaluate(async () => {
    const folderC = await chrome.bookmarks.create({
      parentId: "1",
      title: "Cross Drag Folder C",
    });
    const folderD = await chrome.bookmarks.create({
      parentId: "1",
      title: "Cross Drag Folder D",
    });
    return { folderCId: folderC.id, folderDId: folderD.id };
  });

  await page.reload();

  const bookmarksBarRow = page.locator(".folder-row", {
    has: page.getByRole("button", { name: "Bookmarks bar", exact: true }),
  });
  await bookmarksBarRow.getByRole("button", { name: "Expand folder" }).click();

  const folderCButton = page.getByRole("button", {
    name: "Cross Drag Folder C",
    exact: true,
  });
  const folderDButton = page.getByRole("button", {
    name: "Cross Drag Folder D",
    exact: true,
  });
  await expect(folderCButton).toBeVisible();
  await expect(folderDButton).toBeVisible();

  const sourceBox = await folderCButton.boundingBox();
  const targetBox = await folderDButton.boundingBox();
  if (!sourceBox || !targetBox) throw new Error("Could not measure elements");

  await dragBetween(
    page,
    {
      x: sourceBox.x + sourceBox.width / 2,
      y: sourceBox.y + sourceBox.height / 2,
    },
    {
      x: targetBox.x + targetBox.width / 2,
      y: targetBox.y + targetBox.height / 2,
    },
  );

  // Same-tab optimistic update: folder C is no longer a direct child row
  // under Bookmarks Bar once it's been reparented under folder D.
  await expect(folderCButton).not.toBeVisible();

  await expect
    .poll(async () => {
      const [node] = await page.evaluate(
        (id) => chrome.bookmarks.get(id),
        folderCId,
      );
      return node?.parentId;
    })
    .toBe(folderDId);

  // Expanding folder D reveals folder C nested underneath it.
  const folderDRow = page.locator(".folder-row", {
    has: folderDButton,
  });
  await clickUntilVisible(
    folderDRow.getByRole("button", { name: "Expand folder" }),
    page.getByRole("button", { name: "Cross Drag Folder C", exact: true }),
  );
});
