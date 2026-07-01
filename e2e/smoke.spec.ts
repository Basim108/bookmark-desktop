import { test, expect } from "./fixtures";

test("new-tab page loads from the extension", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);
  await expect(
    page.getByRole("navigation", { name: "Bookmark folders" }),
  ).toBeVisible();
  // Even a fresh Chromium profile has the built-in root folders (Bookmarks
  // bar, etc.), so the canvas renders — just possibly empty of bookmarks.
  await expect(page.locator(".canvas")).toBeVisible();
  await expect(page.getByText("Loading…")).not.toBeVisible();
});
