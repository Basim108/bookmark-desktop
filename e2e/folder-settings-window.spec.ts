import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "./fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TINY_PNG_PATH = path.join(__dirname, "fixtures", "tiny.png");
const NEWTAB = "src/newtab/index.html";

async function createFolder(
  page: import("@playwright/test").Page,
  title: string,
) {
  return page.evaluate(async (title) => {
    const folder = await chrome.bookmarks.create({ parentId: "1", title });
    return folder.id;
  }, title);
}

/** New folders are created under root id "1" (Bookmarks bar), which the sidebar renders collapsed by default. */
async function expandBookmarksBar(page: import("@playwright/test").Page) {
  const bookmarksBarRow = page.locator(".folder-row", {
    has: page.getByRole("button", { name: "Bookmarks bar", exact: true }),
  });
  await bookmarksBarRow.getByRole("button", { name: "Expand folder" }).click();
}

async function openFolderSettings(
  page: import("@playwright/test").Page,
  folderTitle: string,
) {
  await page
    .locator(".folder-row", { hasText: folderTitle })
    .getByRole("button", { name: "Folder settings" })
    .click();
  return page.getByRole("dialog", { name: "Folder Settings" });
}

test("opening a folder's settings window does not reflow sibling rows", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await createFolder(page, "Alpha");
  await createFolder(page, "Beta");
  await page.reload();
  await expandBookmarksBar(page);

  const betaRow = page.locator(".folder-row", { hasText: "Beta" });
  const before = await betaRow.boundingBox();
  if (!before) throw new Error("Could not measure Beta row");

  const dialog = await openFolderSettings(page, "Alpha");
  await expect(dialog).toBeVisible();

  const after = await betaRow.boundingBox();
  expect(after?.y).toBeCloseTo(before.y, 0);
});

test("renaming a folder in the window updates it on Save", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await createFolder(page, "Alpha");
  await page.reload();
  await expandBookmarksBar(page);

  const dialog = await openFolderSettings(page, "Alpha");
  await dialog.getByLabel("Name", { exact: true }).fill("Renamed Folder");
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Renamed Folder" }),
  ).toBeVisible();

  const stored = await page.evaluate(async () => {
    const children = await chrome.bookmarks.getChildren("1");
    return children.map((node) => node.title);
  });
  expect(stored).toContain("Renamed Folder");
  expect(stored).not.toContain("Alpha");
});

test("closing the window without saving discards edits", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await createFolder(page, "Alpha");
  await page.reload();
  await expandBookmarksBar(page);

  const dialog = await openFolderSettings(page, "Alpha");
  await dialog.getByLabel("Name", { exact: true }).fill("Discarded Name");
  await dialog.getByRole("button", { name: "Close" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Alpha" })).toBeVisible();
  await expect(page.getByText("Discarded Name")).toHaveCount(0);
});

test("pressing Escape closes the window without saving", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await createFolder(page, "Alpha");
  await page.reload();
  await expandBookmarksBar(page);

  const dialog = await openFolderSettings(page, "Alpha");
  await dialog.getByLabel("Name", { exact: true }).fill("Discarded Name");
  await page.keyboard.press("Escape");

  await expect(dialog).toBeHidden();
  const stored = await page.evaluate(async () => {
    const children = await chrome.bookmarks.getChildren("1");
    return children.map((node) => node.title);
  });
  expect(stored).toContain("Alpha");
  expect(stored).not.toContain("Discarded Name");
});

test("uploading a custom image persists it and shows it on the folder row", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await createFolder(page, "Alpha");
  await page.reload();
  await expandBookmarksBar(page);

  const dialog = await openFolderSettings(page, "Alpha");
  // No display-mode options — the row always shows icon + name.
  await expect(dialog.getByRole("radio")).toHaveCount(0);

  await dialog.getByLabel("Upload image").setInputFiles(TINY_PNG_PATH);
  const preview = dialog.locator(
    ".folder-settings-window-icon-preview .custom-icon",
  );
  await expect(preview).toBeVisible();

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  // The folder row shows its custom icon alongside the name.
  const alphaRow = page.locator(".folder-row", { hasText: "Alpha" });
  await expect(alphaRow.locator(".custom-icon")).toBeVisible();
});

test("Remove folder deletes it from the sidebar and Chrome after confirmation", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await createFolder(page, "Removable");
  await page.reload();
  await expandBookmarksBar(page);

  const dialog = await openFolderSettings(page, "Removable");
  await dialog.getByRole("button", { name: "Remove folder" }).click();
  await dialog.getByRole("button", { name: "Confirm remove" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Removable" })).toHaveCount(0);

  const remaining = await page.evaluate(async () => {
    const children = await chrome.bookmarks.getChildren("1");
    return children.filter((node) => node.title === "Removable").length;
  });
  expect(remaining).toBe(0);
});
