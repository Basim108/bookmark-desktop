import { test, expect } from "./fixtures";

const NEWTAB = "src/newtab/index.html";

/**
 * Puts the state the service worker leaves behind on update.
 *
 * The real onInstalled event cannot be provoked from a test — an unpacked
 * extension loaded into a fresh profile always fires reason "install" — so the
 * spec seeds what that handler writes and exercises everything downstream of
 * it. The handler's own branching is covered by unit tests.
 */
async function seedPendingNotice(
  page: import("@playwright/test").Page,
): Promise<void> {
  const version = await page.evaluate(
    () => chrome.runtime.getManifest().version,
  );
  await page.evaluate(
    (to) =>
      chrome.storage.local.set({
        releaseNotice: { pending: { from: "0.0.1", to } },
      }),
    version,
  );
}

test("a fresh profile is shown nothing", async ({ context, extensionId }) => {
  // Also the reason the rest of the e2e suite needed no changes: loading the
  // unpacked extension fires reason "install", which announces nothing.
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);

  await expect(page.getByText("Bookmarks Bar")).toBeVisible();
  await expect(page.getByRole("dialog", { name: "What's new" })).toBeHidden();
});

test("an update announces itself once and stays dismissed", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await seedPendingNotice(page);

  await page.reload();
  const dialog = page.getByRole("dialog", { name: "What's new" });
  await expect(dialog).toBeVisible();

  await page.getByRole("button", { name: "Close What's new" }).click();
  await expect(dialog).toBeHidden();

  // A new page, as the user's next new tab would be.
  const later = await context.newPage();
  await later.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await expect(later.getByText("Bookmarks Bar")).toBeVisible();
  await expect(later.getByRole("dialog", { name: "What's new" })).toBeHidden();
});

test("leaving without dismissing shows it again on the next tab", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await seedPendingNotice(page);
  await page.reload();
  await expect(page.getByRole("dialog", { name: "What's new" })).toBeVisible();

  // Navigating away is not a dismissal: the message was never delivered.
  await page.close();

  const later = await context.newPage();
  await later.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await expect(later.getByRole("dialog", { name: "What's new" })).toBeVisible();
});

test("dismissing in one tab closes it in every other open tab", async ({
  context,
  extensionId,
}) => {
  const pageA = await context.newPage();
  await pageA.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await seedPendingNotice(pageA);
  await pageA.reload();

  const pageB = await context.newPage();
  await pageB.goto(`chrome-extension://${extensionId}/${NEWTAB}`);

  await expect(pageA.getByRole("dialog", { name: "What's new" })).toBeVisible();
  await expect(pageB.getByRole("dialog", { name: "What's new" })).toBeVisible();

  await pageA.getByRole("button", { name: "Close What's new" }).click();

  // pageB was never reloaded — this only passes if chrome.storage.onChanged
  // propagated the dismissal live, the same mechanism the layout already uses.
  await expect(pageB.getByRole("dialog", { name: "What's new" })).toBeHidden();
});

test("the About control reaches the same window from settings", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${NEWTAB}`);
  await page.getByRole("button", { name: "Open settings" }).click();

  await page.getByRole("button", { name: "About" }).click();

  const about = page.getByRole("dialog", { name: "About" });
  await expect(about).toBeVisible();
  const version = await page.evaluate(
    () => chrome.runtime.getManifest().version,
  );
  await expect(about).toContainText(version);

  // Escape closes only the topmost window; Settings stays open behind it.
  await page.keyboard.press("Escape");
  await expect(about).toBeHidden();
  await expect(page.getByRole("dialog", { name: "Settings" })).toBeVisible();
});
