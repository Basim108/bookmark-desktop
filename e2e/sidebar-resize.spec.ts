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

const TIERS = [
  { viewportWidth: 900, label: "small/medium", maxWidth: 212 },
  { viewportWidth: 1280, label: "large", maxWidth: 512 },
  { viewportWidth: 2000, label: "ultra-large", maxWidth: 1024 },
];

for (const { viewportWidth, label, maxWidth } of TIERS) {
  test(`dragging past the maximum clamps to ${maxWidth}px on a ${label} screen (viewport ${viewportWidth}px)`, async ({
    context,
    extensionId,
  }) => {
    const page = await context.newPage();
    await page.setViewportSize({ width: viewportWidth, height: 800 });
    await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

    const sidebar = page.locator(".sidebar");
    const handle = page.locator(".sidebar-resize-handle");
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error("Could not measure resize handle");

    await page.mouse.move(
      handleBox.x + handleBox.width / 2,
      handleBox.y + handleBox.height / 2,
    );
    await page.mouse.down();
    await page.mouse.move(viewportWidth, handleBox.y + handleBox.height / 2, {
      steps: 5,
    });
    await page.mouse.up();

    // Max content width plus the sidebar's 1px right border.
    await expect
      .poll(async () => (await sidebar.boundingBox())?.width)
      .toBeCloseTo(maxWidth + 1, 0);
  });
}

test("shrinking the browser window live-clamps an over-cap sidebar, and widening it back restores the preferred width", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 2000, height: 800 });
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const sidebar = page.locator(".sidebar");
  const handle = page.locator(".sidebar-resize-handle");
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Could not measure resize handle");

  // Drag to 900px, well within the ultra-large tier's 1024px cap.
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 660, handleBox.y, {
    steps: 5,
  });
  await page.mouse.up();
  await expect
    .poll(async () => (await sidebar.boundingBox())?.width)
    .toBeCloseTo(901, 0);

  // Shrink into the small/medium tier (212px cap) — no further drag.
  await page.setViewportSize({ width: 900, height: 800 });
  await expect
    .poll(async () => (await sidebar.boundingBox())?.width)
    .toBeCloseTo(213, 0);

  // Widen back into the ultra-large tier — the original 900px preference
  // is restored without a further drag.
  await page.setViewportSize({ width: 2000, height: 800 });
  await expect
    .poll(async () => (await sidebar.boundingBox())?.width)
    .toBeCloseTo(901, 0);
});

test("row controls are large enough and separated enough to hit accurately", async ({
  context,
  extensionId,
}) => {
  // These controls sit adjacent at the row's right edge, so an undersized or
  // touching target means pressing the wrong action. 24px is the WCAG 2.2
  // minimum pointer target; the glyph inside stays at the 16px the
  // folder-sidebar spec pins for the gear.
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);
  await page.waitForSelector(".folder-row");

  const measured = await page.evaluate(() => {
    const row = document.querySelector(".folder-row") as HTMLElement;
    const importButton = row.querySelector(
      ".folder-import-utab",
    ) as HTMLElement;
    const addButton = row.querySelector(".folder-add-subfolder") as HTMLElement;
    const importRect = importButton.getBoundingClientRect();
    const addRect = addButton.getBoundingClientRect();
    return {
      importWidth: importRect.width,
      importHeight: importRect.height,
      addWidth: addRect.width,
      addHeight: addRect.height,
      gap: addRect.left - importRect.right,
      glyphFontSize: getComputedStyle(importButton).fontSize,
    };
  });

  expect(measured.importWidth).toBeGreaterThanOrEqual(24);
  expect(measured.importHeight).toBeGreaterThanOrEqual(24);
  expect(measured.addWidth).toBeGreaterThanOrEqual(24);
  expect(measured.addHeight).toBeGreaterThanOrEqual(24);
  expect(measured.gap).toBeGreaterThanOrEqual(6);
  // Growing the hit target must not have grown the glyph.
  expect(measured.glyphFontSize).toBe("16px");
});

test("hovering one row control highlights only that control", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);
  await page.waitForSelector(".folder-row");

  const row = page.locator(".folder-row").first();
  const importButton = row.getByRole("button", {
    name: "Import uTab Bookmarks",
  });
  const addButton = row.getByRole("button", { name: "Add subfolder" });

  await importButton.hover();

  // Both opacity and background-color are transitioned, so reading computed
  // style immediately after hover() catches the *starting* values mid-flight.
  // Poll until the transition settles rather than asserting on a frame.
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const row = document.querySelector(".folder-row") as HTMLElement;
        const importButton = row.querySelector(
          ".folder-import-utab",
        ) as HTMLElement;
        return getComputedStyle(importButton).backgroundColor;
      }),
    )
    .not.toBe("rgba(0, 0, 0, 0)");

  // Its neighbour stays transparent — that contrast is what tells the user
  // which of two adjacent buttons is about to be pressed.
  const neighbourBackground = await page.evaluate(() => {
    const row = document.querySelector(".folder-row") as HTMLElement;
    const addButton = row.querySelector(".folder-add-subfolder") as HTMLElement;
    return getComputedStyle(addButton).backgroundColor;
  });
  expect(neighbourBackground).toBe("rgba(0, 0, 0, 0)");
  await expect(addButton).toBeVisible();
});
