import { test, expect } from "./fixtures";

test("new-tab page loads from the extension", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);
  await expect(page.getByText(/Bookmark Desktop/i)).toBeVisible();
});
