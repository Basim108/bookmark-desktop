import { test, expect } from "./fixtures";

test("dragging the sidebar's right border resizes it, clamped to a 40px minimum, and the width persists", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const sidebar = page.locator(".sidebar");
  const handle = page.locator(".sidebar-resize-handle");
  await expect(handle).toHaveCSS("cursor", "col-resize");

  const startBox = await sidebar.boundingBox();
  if (!startBox) throw new Error("Could not measure sidebar");
  const startWidth = startBox.width;

  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Could not measure resize handle");

  // Drag the handle 60px to the right to grow the sidebar.
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 60,
    handleBox.y + handleBox.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();

  await expect
    .poll(async () => (await sidebar.boundingBox())?.width)
    .toBeCloseTo(startWidth + 60, 0);

  // Reload and confirm the resized width persisted.
  await page.reload();
  await expect
    .poll(async () => (await sidebar.boundingBox())?.width)
    .toBeCloseTo(startWidth + 60, 0);

  // Drag far past the left edge — width should clamp at the 40px minimum.
  const handleBox2 = await handle.boundingBox();
  if (!handleBox2) throw new Error("Could not measure resize handle");
  await page.mouse.move(
    handleBox2.x + handleBox2.width / 2,
    handleBox2.y + handleBox2.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(0, handleBox2.y + handleBox2.height / 2, {
    steps: 5,
  });
  await page.mouse.up();

  // 40px content width plus the sidebar's 1px right border.
  await expect
    .poll(async () => (await sidebar.boundingBox())?.width)
    .toBeCloseTo(41, 0);
});

test("sidebar hides native scrollbars while remaining wheel-scrollable", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const scrollArea = page.locator(".sidebar-scroll-area");
  await expect(scrollArea).toHaveCSS("scrollbar-width", "none");
});
