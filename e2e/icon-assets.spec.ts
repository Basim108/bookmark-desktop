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

test("uploading a custom icon in the Edit Bookmark window replaces the favicon on Save, and removing it reverts back", async ({
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

  await page.getByRole("button", { name: "Edit Icon Upload Bookmark" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Bookmark" });
  await dialog.getByLabel("Upload image").setInputFiles(TINY_PNG_PATH);

  // Staged preview shows immediately inside the window...
  await expect(
    dialog.getByRole("img", { name: "Icon Upload Bookmark" }),
  ).toHaveAttribute("src", /^blob:/);

  // ...but only Save persists it to the canvas.
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByRole("img", { name: "Icon Upload Bookmark" }),
  ).toHaveAttribute("src", /^blob:/);

  // Persists across reload — settings/icon bytes are both stored.
  await page.reload();
  await expect(
    page.getByRole("img", { name: "Icon Upload Bookmark" }),
  ).toHaveAttribute("src", /^blob:/);

  await page.getByRole("button", { name: "Edit Icon Upload Bookmark" }).click();
  await dialog.getByRole("button", { name: "Remove image" }).click();
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(dialog).toBeHidden();
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

  await page.getByRole("button", { name: "Edit SVG Reject Bookmark" }).click();
  const dialog = page.getByRole("dialog", { name: "Edit Bookmark" });
  await dialog.getByLabel("Upload image").setInputFiles(TINY_SVG_PATH);

  await expect(dialog.getByRole("alert")).toContainText(
    /unsupported file type/i,
  );
  await expect(
    dialog.getByRole("img", { name: "SVG Reject Bookmark" }),
  ).toHaveAttribute("src", /_favicon/);
});
