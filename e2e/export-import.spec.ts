import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "./fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TINY_PNG_PATH = path.join(__dirname, "fixtures", "tiny.png");
const NEWTAB = "src/newtab/index.html";

type Page = import("@playwright/test").Page;

function openSettings(page: Page) {
  return page.getByRole("button", { name: "Open settings" }).click();
}

/** Seeds a folder with one bookmark under the Bookmarks bar (root "1"). */
async function seedFolderWithBookmark(page: Page) {
  return page.evaluate(async () => {
    const folder = await chrome.bookmarks.create({
      parentId: "1",
      title: "RoundTrip",
    });
    await chrome.bookmarks.create({
      parentId: folder.id,
      title: "KeepMe",
      url: "https://example.com/keepme",
    });
    return folder.id;
  });
}

test("export then import restores the bookmark tree and canvas background", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);

  // Seed a folder + bookmark and a canvas background — the state to round-trip.
  const folderId = await seedFolderWithBookmark(page);
  await page.reload();

  await openSettings(page);
  let dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByLabel("Upload image").setInputFiles(TINY_PNG_PATH);
  await expect(
    dialog.getByRole("img", { name: "Background preview" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator(".canvas")).toHaveCSS(
    "background-image",
    /^url\("?blob:/,
  );

  // Export: the button downloads the state file and closes the window.
  await openSettings(page);
  dialog = page.getByRole("dialog", { name: "Settings" });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Export" }).click(),
  ]);
  const dir = await mkdtemp(path.join(tmpdir(), "bmk-export-"));
  const exportPath = path.join(dir, download.suggestedFilename());
  await download.saveAs(exportPath);
  await expect(dialog).toBeHidden();
  expect(download.suggestedFilename()).toMatch(
    /^\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-bookmark-desktop\.json$/,
  );

  // Wipe the seeded state so the import has something to restore.
  await page.evaluate(async (folderId) => {
    await chrome.bookmarks.removeTree(folderId);
    await chrome.storage.local.set({
      generalSettings: { background: { kind: "none" } },
    });
  }, folderId);
  await page.reload();
  await expect(page.locator(".canvas")).toHaveCSS("background-image", "none");

  // Import: choose the file, then answer the custom Yes/No/Cancel confirmation.
  await openSettings(page);
  dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByLabel("Import backup file").setInputFiles(exportPath);

  const confirm = page.getByRole("alertdialog", { name: "Import Bookmarks" });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText(/replace/i);
  // "No" = import without an extra backup. On success the page reloads.
  await confirm.getByRole("button", { name: "No", exact: true }).click();

  // Chrome's own store holds the recreated folder + bookmark under root "1".
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const bar = await chrome.bookmarks.getChildren("1");
        const folder = bar.find((n) => n.title === "RoundTrip");
        if (!folder) return null;
        const kids = await chrome.bookmarks.getChildren(folder.id);
        return kids.map((k) => ({ title: k.title, url: k.url }));
      }),
    )
    .toEqual([{ title: "KeepMe", url: "https://example.com/keepme" }]);

  // The background is restored too (the import reloaded the page already).
  await expect(page.locator(".canvas")).toHaveCSS(
    "background-image",
    /^url\("?blob:/,
  );
});

test("a replace-import leaves no stored data belonging to the replaced tree", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);

  // Export an essentially empty state; importing it later replaces everything.
  await openSettings(page);
  let dialog = page.getByRole("dialog", { name: "Settings" });
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    dialog.getByRole("button", { name: "Export" }).click(),
  ]);
  const dir = await mkdtemp(path.join(tmpdir(), "bmk-residue-"));
  const emptyStatePath = path.join(dir, download.suggestedFilename());
  await download.saveAs(emptyStatePath);

  // Now build a tree with stored positions and a custom icon, so the import
  // has real per-item data to strand. The transfer lock suspends the onRemoved
  // cleanup, so only the importer's own sweep can collect this.
  const seeded = await seedFolderWithBookmark(page);
  await page.reload();
  await page.evaluate(async (folderId) => {
    const [bookmark] = await chrome.bookmarks.getChildren(folderId);
    await chrome.storage.local.set({
      positions: {
        [folderId]: { [bookmark!.id]: { page: 0, row: 2, col: 3 } },
      },
      bookmarkSettings: {
        [bookmark!.id]: { labelDisplay: "tooltip", hasCustomIcon: true },
      },
      folderSettings: { [folderId]: { hasCustomIcon: true } },
    });
  }, seeded);

  const seededIds = await page.evaluate(async (folderId) => {
    const kids = await chrome.bookmarks.getChildren(folderId);
    return [folderId, ...kids.map((k) => k.id)];
  }, seeded);

  // Import the empty state: everything seeded above is deleted.
  await openSettings(page);
  dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByLabel("Import backup file").setInputFiles(emptyStatePath);
  const confirm = page.getByRole("alertdialog", { name: "Import Bookmarks" });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "No", exact: true }).click();

  // No stored entry may remain under any of the replaced tree's ids.
  await expect
    .poll(() =>
      page.evaluate(async (ids) => {
        const stored = await chrome.storage.local.get([
          "positions",
          "bookmarkSettings",
          "folderSettings",
        ]);
        const blob = JSON.stringify(stored);
        return ids.filter((id) => blob.includes(`"${id}"`));
      }, seededIds),
    )
    .toEqual([]);
});
