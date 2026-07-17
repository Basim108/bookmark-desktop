import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "./fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UTAB_JSON_PATH = path.join(__dirname, "fixtures", "utab-sample.json");
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

/** New folders live under root id "1" (Bookmarks bar), which the sidebar renders collapsed by default. */
async function expandBookmarksBar(page: import("@playwright/test").Page) {
  const bookmarksBarRow = page.locator(".folder-row", {
    has: page.getByRole("button", { name: "Bookmarks bar", exact: true }),
  });
  await bookmarksBarRow.getByRole("button", { name: "Expand folder" }).click();
}

test("Import uTab recreates folders, bookmarks, and icons inside the selected folder", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await createFolder(page, "Target");
  await page.reload();
  await expandBookmarksBar(page);

  // Open the target folder's settings and import the uTab export into it.
  await page
    .locator(".folder-row", { hasText: "Target" })
    .getByRole("button", { name: "Folder settings" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Folder Settings" });
  await expect(dialog).toBeVisible();

  await dialog
    .getByLabel("Import bookmarks file")
    .setInputFiles(UTAB_JSON_PATH);

  // The window reports the result without closing.
  await expect(
    dialog.getByText("Imported 1 folder, 2 bookmarks."),
  ).toBeVisible();

  // Chrome's own store now holds the recreated structure under Target.
  const structure = await page.evaluate(async () => {
    const [target] = await chrome.bookmarks
      .getChildren("1")
      .then((children) => children.filter((node) => node.title === "Target"));
    const subfolders = await chrome.bookmarks.getChildren(target!.id);
    const bookmarks = await chrome.bookmarks.getChildren(subfolders[0]!.id);
    return {
      subfolderTitles: subfolders.map((f) => f.title),
      bookmarks: bookmarks.map((b) => ({ title: b.title, url: b.url })),
    };
  });
  expect(structure.subfolderTitles).toEqual(["Imported Folder"]);
  expect(structure.bookmarks).toEqual([
    { title: "Imported Alpha", url: "https://example.com/imported-alpha" },
    { title: "Imported Beta", url: "https://example.com/imported-beta" },
  ]);

  // Close the settings window and reveal the imported subfolder in the sidebar.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  const targetRow = page.locator(".folder-row", { hasText: "Target" });
  await targetRow.getByRole("button", { name: "Expand folder" }).click();

  const importedRow = page.locator(".folder-row", {
    has: page.getByRole("button", { name: "Imported Folder", exact: true }),
  });
  await expect(importedRow).toBeVisible();
  // The imported folder carried a preview, so its row shows a custom icon.
  await expect(importedRow.locator(".custom-icon")).toBeVisible();

  // Selecting the imported folder filters the canvas to its bookmarks.
  await page
    .getByRole("button", { name: "Imported Folder", exact: true })
    .click();
  await expect(page.getByText("Imported Alpha")).toBeVisible();
  await expect(page.getByText("Imported Beta")).toBeVisible();
});
