import { test, expect } from "./fixtures";

const NEWTAB = "src/newtab/index.html";

test("editing name and URL in the window updates the bookmark on Save", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);

  await page.evaluate(async () => {
    await chrome.bookmarks.create({
      parentId: "1",
      title: "Editable Bookmark",
      url: "https://old.example.com/",
    });
  });
  await page.reload();

  await page.getByRole("button", { name: "Edit Editable Bookmark" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Bookmark" });
  await dialog.getByLabel("Name").fill("Renamed Bookmark");
  await dialog.getByLabel("URL").fill("https://new.example.com/");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Renamed Bookmark")).toBeVisible();

  const stored = await page.evaluate(async () => {
    const children = await chrome.bookmarks.getChildren("1");
    return children.find((node) => node.title === "Renamed Bookmark")?.url;
  });
  expect(stored).toBe("https://new.example.com/");
});

test("closing the window without saving discards edits", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);

  await page.evaluate(async () => {
    await chrome.bookmarks.create({
      parentId: "1",
      title: "Keep Me",
      url: "https://keep.example.com/",
    });
  });
  await page.reload();

  await page.getByRole("button", { name: "Edit Keep Me" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Bookmark" });
  await dialog.getByLabel("Name").fill("Discarded Name");
  await dialog.getByRole("button", { name: "Close" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Keep Me")).toBeVisible();
  await expect(page.getByText("Discarded Name")).toHaveCount(0);
});

test("Remove deletes the bookmark from the canvas and Chrome after confirmation", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);

  await page.evaluate(async () => {
    await chrome.bookmarks.create({
      parentId: "1",
      title: "Removable Bookmark",
      url: "https://remove.example.com/",
    });
  });
  await page.reload();

  await expect(
    page.getByRole("img", { name: "Removable Bookmark" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Edit Removable Bookmark" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Bookmark" });
  await dialog.getByRole("button", { name: "Remove" }).click();
  await dialog.getByRole("button", { name: "Confirm remove" }).click();

  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("img", { name: "Removable Bookmark" }),
  ).toHaveCount(0);

  const remaining = await page.evaluate(async () => {
    const children = await chrome.bookmarks.getChildren("1");
    return children.filter((node) => node.title === "Removable Bookmark")
      .length;
  });
  expect(remaining).toBe(0);
});
