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
