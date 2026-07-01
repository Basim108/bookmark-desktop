import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "./fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TINY_PNG_PATH = path.join(__dirname, "fixtures", "tiny.png");
const TINY_SVG_PATH = path.join(__dirname, "fixtures", "tiny.svg");

test("bookmark's favicon renders via the _favicon API by default", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  await page.evaluate(async () => {
    await chrome.bookmarks.create({
      parentId: "1",
      title: "Favicon Test Bookmark",
      url: "https://example.com/favicon-test",
    });
  });
  await page.reload();

  const img = page.getByRole("img", { name: "Favicon Test Bookmark" });
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute("src", /_favicon/);
});

test("uploading a custom icon replaces the favicon, and removing it reverts back", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  await page.evaluate(async () => {
    await chrome.bookmarks.create({
      parentId: "1",
      title: "Icon Upload Bookmark",
      url: "https://example.com/icon-upload-test",
    });
  });
  await page.reload();

  await expect(
    page.getByRole("img", { name: "Icon Upload Bookmark" }),
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Icon Upload Bookmark icon settings" })
    .click();
  await page.getByLabel("Upload icon").setInputFiles(TINY_PNG_PATH);

  const customIcon = page.getByRole("img", { name: "Icon Upload Bookmark" });
  await expect(customIcon).toHaveAttribute("src", /^blob:/);

  // Persists across reload — settings/icon bytes are both stored, not
  // held only in memory.
  await page.reload();
  await expect(
    page.getByRole("img", { name: "Icon Upload Bookmark" }),
  ).toHaveAttribute("src", /^blob:/);

  await page
    .getByRole("button", { name: "Icon Upload Bookmark icon settings" })
    .click();
  await page.getByRole("button", { name: "Remove icon" }).click();

  await expect(
    page.getByRole("img", { name: "Icon Upload Bookmark" }),
  ).toHaveAttribute("src", /_favicon/);
});

test("uploading an SVG is rejected with an inline error, and the favicon is left unchanged", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  await page.evaluate(async () => {
    await chrome.bookmarks.create({
      parentId: "1",
      title: "SVG Reject Bookmark",
      url: "https://example.com/svg-reject-test",
    });
  });
  await page.reload();

  await page
    .getByRole("button", { name: "SVG Reject Bookmark icon settings" })
    .click();
  await page.getByLabel("Upload icon").setInputFiles(TINY_SVG_PATH);

  await expect(page.getByRole("alert")).toContainText(/unsupported file type/i);
  await expect(
    page.getByRole("img", { name: "SVG Reject Bookmark" }),
  ).toHaveAttribute("src", /_favicon/);
});
