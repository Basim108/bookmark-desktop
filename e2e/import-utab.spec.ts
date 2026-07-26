import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "./fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UTAB_JSON_PATH = path.join(__dirname, "fixtures", "utab-sample.json");
const UTAB_SKIPS_PATH = path.join(__dirname, "fixtures", "utab-skips.json");
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

test("Import uTab downloads a per-entry report file for skipped entries", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await createFolder(page, "ReportTarget");
  await page.reload();
  await expandBookmarksBar(page);

  await page
    .locator(".folder-row", { hasText: "ReportTarget" })
    .getByRole("button", { name: "Folder settings" })
    .click();
  const dialog = page.getByRole("dialog", { name: "Folder Settings" });
  await expect(dialog).toBeVisible();

  const downloadPromise = page.waitForEvent("download");
  await dialog
    .getByLabel("Import bookmarks file")
    .setInputFiles(UTAB_SKIPS_PATH);

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("utab-skips-report.log");

  // The summary names the report so the user can find it.
  await expect(dialog.getByText(/utab-skips-report\.log/)).toBeVisible();

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const csv = Buffer.concat(chunks).toString("utf8");
  const lines = csv.split("\r\n");

  expect(lines[0]).toBe(
    "status,id,folder,bookmark-title,bookmark-url,skipping-reason,error",
  );

  // The blank-name folder is skipped, and its orphan carries an empty `folder`
  // cell because the blankness is exactly why the parent failed.
  expect(lines).toContain("skipped,f-blank,,   ,,empty-title,");
  expect(lines).toContain(
    "skipped,b-orphan,,Orphaned Bookmark,https://example.com/orphan,parent-skipped,",
  );

  // A formula-shaped title is prefixed AND quoted, so a spreadsheet renders it
  // as inert text rather than evaluating it.
  const formulaLine = lines.find((line) => line.includes("b-formula"))!;
  expect(formulaLine).toContain("\"'=HYPERLINK(");
  expect(formulaLine).not.toContain(",=HYPERLINK(");

  // A folder name containing a comma stays one field.
  expect(formulaLine).toContain('"Reading, Writing"');

  // A scheme-less url is rejected by the safe-scheme allowlist today.
  expect(lines).toContain(
    'skipped,b-schemeless,"Reading, Writing",Scheme Less,google.com,unsafe-url,',
  );

  // An unusable preview is a warning, not a skip — the bookmark still exists.
  expect(lines).toContain(
    'warning,b-badicon,"Reading, Writing",Bad Icon,https://example.com/bad-icon,icon-failed,',
  );

  // The valid entry produced no row at all.
  expect(csv).not.toContain("b-keep");

  const titles = await page.evaluate(async () => {
    const [target] = await chrome.bookmarks
      .getChildren("1")
      .then((children) => children.filter((n) => n.title === "ReportTarget"));
    const subfolders = await chrome.bookmarks.getChildren(target!.id);
    const bookmarks = await chrome.bookmarks.getChildren(subfolders[0]!.id);
    return bookmarks.map((b) => b.title);
  });
  expect(titles).toEqual(["Bad Icon", "Keeper"]);
});
