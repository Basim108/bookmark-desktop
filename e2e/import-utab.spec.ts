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

  // The summary names the report so the user can find it, and counts only real
  // entries. The three url-less slots are not entries; the blank-named folder
  // and the untitled bookmark now fall back rather than skipping; so the two
  // unusable urls are all that is left.
  await expect(
    dialog.getByText(
      "Imported 2 folders, 4 bookmarks — skipped 2. Details in utab-skips-report.log.",
    ),
  ).toBeVisible();

  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  const csv = Buffer.concat(chunks).toString("utf8");
  const lines = csv.split("\r\n");

  expect(lines[0]).toBe(
    "status,id,folder,bookmark-title,bookmark-url,skipping-reason,error",
  );

  // A blank folder name is defaulted rather than skipped, so neither it nor the
  // bookmark it would once have orphaned appears in the report at all.
  expect(csv).not.toContain("f-blank");
  expect(csv).not.toContain("b-orphan,");
  expect(csv).not.toContain("parent-skipped");

  // A blank bookmark title falls back to its url, so it is not a skip either.
  expect(csv).not.toContain("b-untitled");

  // A formula-shaped title is prefixed AND quoted, so a spreadsheet renders it
  // as inert text rather than evaluating it.
  const formulaLine = lines.find((line) => line.includes("b-formula"))!;
  expect(formulaLine).toContain("\"'=HYPERLINK(");
  expect(formulaLine).not.toContain(",=HYPERLINK(");

  // A folder name containing a comma stays one field.
  expect(formulaLine).toContain('"Reading, Writing"');

  // A scheme-less url is rejected by the safe-scheme allowlist today. This is
  // the boundary marker for empty slots: "no url" is ignored, "bad url" is not.
  expect(lines).toContain(
    'skipped,b-schemeless,"Reading, Writing",Scheme Less,google.com,unsafe-url,',
  );

  // Entries with no url are empty uTab grid slots, not failed imports: they
  // produce no rows at all, on the main path and under a skipped folder alike.
  expect(csv).not.toContain("b-slot");
  expect(csv).not.toContain("b-slot-blank");
  expect(csv).not.toContain("b-orphan-slot");

  // An unusable preview is a warning, not a skip — the bookmark still exists.
  expect(lines).toContain(
    'warning,b-badicon,"Reading, Writing",Bad Icon,https://example.com/bad-icon,icon-failed,',
  );

  // The valid entry produced no row at all.
  expect(csv).not.toContain("b-keep");

  const structure = await page.evaluate(async () => {
    const [target] = await chrome.bookmarks
      .getChildren("1")
      .then((children) => children.filter((n) => n.title === "ReportTarget"));
    const subfolders = await chrome.bookmarks.getChildren(target!.id);
    return {
      folders: subfolders.map((f) => f.title),
      bookmarks: await Promise.all(
        subfolders.map(async (f) =>
          (await chrome.bookmarks.getChildren(f.id)).map((b) => b.title),
        ),
      ),
    };
  });
  // The blank-named folder kept its bookmark instead of taking it down with it,
  // and the untitled entry carries its full url as its title.
  expect(structure.folders).toEqual(["New Folder", "Reading, Writing"]);
  expect(structure.bookmarks).toEqual([
    ["Orphaned Bookmark"],
    ["Bad Icon", "Keeper", "https://example.com/untitled/deep/path"],
  ]);

  // The substituted url is shown on hover, never as a label under the icon.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await page
    .locator(".folder-row", { hasText: "ReportTarget" })
    .getByRole("button", { name: "Expand folder" })
    .click();
  await page
    .getByRole("button", { name: "Reading, Writing", exact: true })
    .click();

  const rescued = page.locator(".bookmark-icon-wrapper", {
    has: page.getByRole("button", {
      name: "Edit https://example.com/untitled/deep/path",
    }),
  });
  await expect(rescued).toBeVisible();
  await expect(rescued.locator(".bookmark-icon-label")).toHaveCount(0);
  await expect(rescued.locator("button.bookmark-icon")).toHaveAttribute(
    "title",
    "https://example.com/untitled/deep/path",
  );
  // A titled sibling still shows its label, so the tooltip mode is targeted.
  const keeper = page.locator(".bookmark-icon-wrapper", {
    has: page.getByRole("button", { name: "Edit Keeper" }),
  });
  await expect(keeper.locator(".bookmark-icon-label")).toHaveText("Keeper");
});

test("Import uTab from a root folder row confirms the target, then imports into it", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);

  const bookmarksBarRow = page.locator(".folder-row", {
    has: page.getByRole("button", { name: "Bookmarks bar", exact: true }),
  });

  // Root rows have no gear, so before this entry point existed there was no
  // way to import here at all.
  await expect(
    bookmarksBarRow.getByRole("button", { name: "Folder settings" }),
  ).toHaveCount(0);

  await bookmarksBarRow
    .getByRole("button", { name: "Import uTab Bookmarks" })
    .click();

  // The confirmation names the destination, and must not be the settings window.
  const confirm = page.getByRole("dialog", { name: "Import uTab Bookmarks" });
  await expect(confirm).toBeVisible();
  await expect(confirm.getByText("Bookmarks bar")).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "Folder Settings" }),
  ).toHaveCount(0);

  await confirm.getByRole("button", { name: "Choose file…" }).click();
  await page
    .getByLabel("Import uTab bookmarks file")
    .setInputFiles(UTAB_JSON_PATH);

  // The result arrives in the toast and stays until acknowledged.
  const toast = page.getByRole("status", { name: "Import status" });
  await expect(toast).toContainText("Imported 1 folder, 2 bookmarks.");

  const structure = await page.evaluate(async () => {
    const children = await chrome.bookmarks.getChildren("1");
    const imported = children.find((n) => n.title === "Imported Folder");
    const bookmarks = await chrome.bookmarks.getChildren(imported!.id);
    return bookmarks.map((b) => ({ title: b.title, url: b.url }));
  });
  expect(structure).toEqual([
    { title: "Imported Alpha", url: "https://example.com/imported-alpha" },
    { title: "Imported Beta", url: "https://example.com/imported-beta" },
  ]);

  // Selecting another folder must not take the result away.
  await page
    .getByRole("button", { name: "Other bookmarks", exact: true })
    .click();
  await expect(toast).toBeVisible();

  await toast.getByRole("button", { name: "OK" }).click();
  await expect(toast).toHaveCount(0);
});

test("Cancelling the root import confirmation creates nothing", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);

  const before = await page.evaluate(() =>
    chrome.bookmarks.getChildren("1").then((c) => c.length),
  );

  await page
    .locator(".folder-row", {
      has: page.getByRole("button", { name: "Bookmarks bar", exact: true }),
    })
    .getByRole("button", { name: "Import uTab Bookmarks" })
    .click();

  const confirm = page.getByRole("dialog", { name: "Import uTab Bookmarks" });
  await confirm.getByRole("button", { name: "Cancel" }).click();
  await expect(confirm).toHaveCount(0);

  await expect(page.getByRole("status", { name: "Import status" })).toHaveCount(
    0,
  );
  const after = await page.evaluate(() =>
    chrome.bookmarks.getChildren("1").then((c) => c.length),
  );
  expect(after).toBe(before);
});
