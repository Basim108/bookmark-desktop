import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "./fixtures";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TINY_PNG_PATH = path.join(__dirname, "fixtures", "tiny.png");
const NEWTAB = "src/newtab/index.html";

function openSettings(page: import("@playwright/test").Page) {
  return page.getByRole("button", { name: "Open settings" }).click();
}

test("hamburger opens the Settings window and it closes on Escape", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);

  await openSettings(page);
  const dialog = page.getByRole("dialog", { name: "Settings" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("No background")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test("uploading a background applies it to the canvas only, not the sidebar", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);

  await openSettings(page);
  const dialog = page.getByRole("dialog", { name: "Settings" });

  await dialog.getByLabel("Upload image").setInputFiles(TINY_PNG_PATH);
  await expect(
    dialog.getByRole("img", { name: "Background preview" }),
  ).toBeVisible();
  // Fit control appears, defaulting to Cover.
  await expect(dialog.getByRole("radio", { name: "Cover" })).toBeChecked();

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  // The canvas carries a blob-backed background image, sized "cover".
  const canvas = page.locator(".canvas");
  await expect(canvas).toHaveCSS("background-image", /^url\("?blob:/);
  await expect(canvas).toHaveCSS("background-size", "cover");

  // The sidebar keeps its own background — the image is canvas-only.
  const sidebarBg = await page
    .locator(".sidebar")
    .evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(sidebarBg).toBe("none");
});

test("background persists across a reload and can be removed", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);

  // Set a background.
  await openSettings(page);
  let dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByLabel("Upload image").setInputFiles(TINY_PNG_PATH);
  await expect(
    dialog.getByRole("img", { name: "Background preview" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  // Survives a reload.
  await page.reload();
  await expect(page.locator(".canvas")).toHaveCSS(
    "background-image",
    /^url\("?blob:/,
  );

  // Remove it.
  await openSettings(page);
  dialog = page.getByRole("dialog", { name: "Settings" });
  await dialog.getByRole("button", { name: "Remove image" }).click();
  await expect(dialog.getByText("No background")).toBeVisible();
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.locator(".canvas")).toHaveCSS("background-image", "none");
});
