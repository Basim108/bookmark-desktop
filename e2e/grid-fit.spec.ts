import { test, expect } from "./fixtures";
import type { Page } from "@playwright/test";

/**
 * Grid capacity must be derived from the space cells actually consume — icon
 * size plus inter-cell gap, inside the grid's padding — so nothing renders
 * outside the canvas. These tests assert the rendered geometry rather than the
 * arithmetic (sizing.test.ts covers the formula), because the bug they guard
 * against was precisely a formula that looked right in isolation.
 */

/** Seeds bookmarks in the real Bookmarks Bar (id "1"). */
async function seedBookmarks(page: Page, count: number): Promise<string[]> {
  return page.evaluate(async (n) => {
    const created: string[] = [];
    for (let i = 0; i < n; i++) {
      const node = await chrome.bookmarks.create({
        parentId: "1",
        title: `Fit ${String(i).padStart(2, "0")}`,
        url: `https://example.com/fit-${i}`,
      });
      created.push(node.id);
    }
    return created;
  }, count);
}

/**
 * Waits until the visible page has every cell occupied — the precondition
 * these tests need, since the right-most column and bottom row must actually
 * hold icons for "is it clipped?" to mean anything.
 *
 * Asserts the rendered grid rather than waiting for every seeded bookmark to
 * have a stored position. Both are sound now that positions.ts serializes
 * cross-context writes under one lock, but the rendered check is cheaper and
 * is what these tests actually care about. Seeding well past capacity keeps
 * them independent of exactly how many bookmarks were created.
 */
async function waitForFullPage(page: Page): Promise<void> {
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const grid = Array.from(document.querySelectorAll(".canvas-grid")).find(
          (candidate) => (candidate as HTMLElement).style.display !== "none",
        );
        if (!grid) return null;
        const cells = grid.querySelectorAll(".grid-cell").length;
        const occupied = grid.querySelectorAll(".grid-cell--occupied").length;
        return cells > 0 && cells === occupied;
      }),
    )
    .toBe(true);
}

interface Overflow {
  right: number;
  bottom: number;
  cellRight: number;
  cols: number;
}

/**
 * How far the visible page's content extends past the canvas's right/bottom
 * edges, in px. Positive means clipped. Measured on the highlight surfaces
 * (which are exactly icon-sized) and on the cells themselves, so both a
 * clipped icon and an overflowing track are caught.
 *
 * Bounds are the canvas's, not the grid's. The pagination nav sits inside the
 * canvas and eats grid height that the row count doesn't subtract, so a
 * paginated folder with under ~37px of vertical slack can clip its bottom row
 * while still passing this check. That gap is pre-existing, deliberately out
 * of this change's scope, and documented in the change's design.md.
 */
async function measureOverflow(page: Page): Promise<Overflow> {
  return page.evaluate(() => {
    const canvas = document.querySelector(".canvas");
    if (!canvas) throw new Error("canvas not mounted");
    const canvasRect = canvas.getBoundingClientRect();

    const grid = Array.from(document.querySelectorAll(".canvas-grid")).find(
      (candidate) => (candidate as HTMLElement).style.display !== "none",
    );
    if (!grid) throw new Error("no visible canvas grid");

    let right = -Infinity;
    let bottom = -Infinity;
    for (const surface of grid.querySelectorAll(".grid-cell-surface")) {
      const rect = surface.getBoundingClientRect();
      right = Math.max(right, rect.right - canvasRect.right);
      bottom = Math.max(bottom, rect.bottom - canvasRect.bottom);
    }

    let cellRight = -Infinity;
    for (const cell of grid.querySelectorAll(".grid-cell")) {
      const rect = cell.getBoundingClientRect();
      cellRight = Math.max(cellRight, rect.right - canvasRect.right);
    }

    const template = (grid as HTMLElement).style.gridTemplateColumns;
    const cols = Number(/repeat\((\d+),/.exec(template)?.[1] ?? 0);

    return { right, bottom, cellRight, cols };
  });
}

/** Sub-pixel tolerance: grid tracks resolve to fractional widths. */
const EPSILON = 0.5;

function expectNothingClipped(overflow: Overflow) {
  expect(overflow.right).toBeLessThanOrEqual(EPSILON);
  expect(overflow.bottom).toBeLessThanOrEqual(EPSILON);
  expect(overflow.cellRight).toBeLessThanOrEqual(EPSILON);
}

async function openNewTab(page: Page, extensionId: string) {
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);
}

interface PageOccupancy {
  cells: number;
  occupied: number;
  cols: number;
  rows: number;
}

/** Cell counts and the rendered track counts of the visible page. */
async function measureOccupancy(page: Page): Promise<PageOccupancy> {
  return page.evaluate(() => {
    const grid = Array.from(document.querySelectorAll(".canvas-grid")).find(
      (candidate) => (candidate as HTMLElement).style.display !== "none",
    );
    if (!grid) throw new Error("no visible canvas grid");
    const style = (grid as HTMLElement).style;
    return {
      cells: grid.querySelectorAll(".grid-cell").length,
      occupied: grid.querySelectorAll(".grid-cell--occupied").length,
      cols: Number(/repeat\((\d+),/.exec(style.gridTemplateColumns)?.[1] ?? 0),
      rows: Number(/repeat\((\d+),/.exec(style.gridTemplateRows)?.[1] ?? 0),
    };
  });
}

/**
 * The regression test for this change. The service worker used to place every
 * new bookmark against a hardcoded 6x4, so page 0 could never hold more than
 * 24 icons however large the canvas was — item 24 was stored on page 1 while
 * page 0 still had empty cells, and paginate() never compacts forward.
 *
 * This was impossible to write before: the suite had to keep viewports small
 * enough that capacity stayed under 24 cells.
 */
test("fills page one to the measured capacity, past the old 24-cell ceiling", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1900, height: 1000 });
  // Open the tab first so a capacity is measured and published before any
  // bookmark exists — this is the ordering that makes the SW's placement use
  // the real grid.
  await openNewTab(page, extensionId);

  // Comfortably more than this viewport's capacity, so page 0 fills whatever
  // the tier arithmetic resolves to. (Capacity can't be read before seeding —
  // no grid renders until the folder has bookmarks.)
  await seedBookmarks(page, 70);
  await waitForFullPage(page);

  const filled = await measureOccupancy(page);
  expect(
    filled.cols * filled.rows,
    "viewport must exceed the old 6x4 ceiling for this test to mean anything",
  ).toBeGreaterThan(24);
  expect(filled.occupied).toBe(filled.cols * filled.rows);
});

test("renders every icon fully inside the canvas when the grid is full", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await openNewTab(page, extensionId);

  // Enough to fill several rows at any tier, so the right-most column and the
  // bottom row are both occupied.
  await seedBookmarks(page, 40);
  await page.reload();
  await waitForFullPage(page);

  expectNothingClipped(await measureOverflow(page));
});

test("keeps every icon inside the canvas as the sidebar is widened past a column boundary", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  // Wide enough that a 220px sidebar drag stays inside the 166px tier, so the
  // column count moves monotonically (tier crossing is covered separately).
  // The height no longer has to keep capacity under 24 cells: placement now
  // uses the capacity the page measured, so page 0 fills at any viewport.
  await page.setViewportSize({ width: 1500, height: 900 });
  await openNewTab(page, extensionId);

  await seedBookmarks(page, 40);
  await page.reload();
  await waitForFullPage(page);

  const before = await measureOverflow(page);
  expectNothingClipped(before);

  const handle = page.locator(".sidebar-resize-handle");
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Could not measure resize handle");
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  // Drag right in steps; a full tier icon's worth of travel guarantees at
  // least one column boundary is crossed.
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let offset = 20; offset <= 220; offset += 20) {
    await page.mouse.move(startX + offset, startY);
    // Nothing may be clipped at any intermediate width either — this is what
    // floorless (minmax(0, 1fr)) tracks buy while capacity catches up a frame
    // later.
    expectNothingClipped(await measureOverflow(page));
  }
  await page.mouse.up();

  const after = await measureOverflow(page);
  expectNothingClipped(after);
  expect(after.cols).toBeLessThan(before.cols);
});

test("keeps every icon inside the canvas as the sidebar is narrowed past a column boundary", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1500, height: 700 });
  await openNewTab(page, extensionId);

  await seedBookmarks(page, 40);
  await page.reload();
  await waitForFullPage(page);

  const handle = page.locator(".sidebar-resize-handle");
  let handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Could not measure resize handle");

  // Widen first so there is room to narrow back past a boundary.
  await page.mouse.move(
    handleBox.x + handleBox.width / 2,
    handleBox.y + handleBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    handleBox.x + handleBox.width / 2 + 220,
    handleBox.y + handleBox.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();

  const before = await measureOverflow(page);
  expectNothingClipped(before);

  handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Could not re-measure resize handle");
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let offset = 20; offset <= 220; offset += 20) {
    await page.mouse.move(startX - offset, startY);
    expectNothingClipped(await measureOverflow(page));
  }
  await page.mouse.up();

  const after = await measureOverflow(page);
  expectNothingClipped(after);
  expect(after.cols).toBeGreaterThan(before.cols);
});

test("keeps every icon inside the canvas when a sidebar resize crosses a tier breakpoint", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  // At 1280px the default sidebar leaves the canvas just above the 1024px
  // breakpoint, so widening the sidebar drops the canvas into the 106px tier
  // mid-drag — icon size and column count both change at once.
  await page.setViewportSize({ width: 1280, height: 800 });
  await openNewTab(page, extensionId);

  await seedBookmarks(page, 40);
  await page.reload();
  await waitForFullPage(page);

  const before = await measureOverflow(page);
  expectNothingClipped(before);

  const handle = page.locator(".sidebar-resize-handle");
  const handleBox = await handle.boundingBox();
  if (!handleBox) throw new Error("Could not measure resize handle");
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  for (let offset = 20; offset <= 220; offset += 20) {
    await page.mouse.move(startX + offset, startY);
    expectNothingClipped(await measureOverflow(page));
  }
  await page.mouse.up();

  const after = await measureOverflow(page);
  expectNothingClipped(after);
  // Crossing down a tier shrinks icons, so the narrower canvas holds *more*
  // columns — the capacity must be recomputed against the new tier's size.
  expect(after.cols).toBeGreaterThan(before.cols);
});

test("paints the hover highlight as an icon-sized square, not the full cell", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await openNewTab(page, extensionId);

  await seedBookmarks(page, 40);
  await page.reload();
  await waitForFullPage(page);

  const geometry = await page.evaluate(() => {
    const grid = Array.from(document.querySelectorAll(".canvas-grid")).find(
      (candidate) => (candidate as HTMLElement).style.display !== "none",
    );
    if (!grid) throw new Error("no visible canvas grid");
    const cell = grid.querySelector(".grid-cell");
    const surface = grid.querySelector(".grid-cell-surface");
    if (!cell || !surface) throw new Error("no cell/surface");
    const cellRect = cell.getBoundingClientRect();
    const surfaceRect = surface.getBoundingClientRect();

    // Two adjacent surfaces must never touch: the gap plus any distributed
    // space stays unpainted, so a hovered row reads as discrete icons.
    const surfaces = Array.from(grid.querySelectorAll(".grid-cell-surface"));
    const first = surfaces[0]?.getBoundingClientRect();
    const second = surfaces[1]?.getBoundingClientRect();

    return {
      cellWidth: cellRect.width,
      surfaceWidth: surfaceRect.width,
      surfaceHeight: surfaceRect.height,
      adjacentSeparation:
        first && second ? second.left - first.right : Number.NaN,
    };
  });

  // At 1280px wide the canvas has leftover width to distribute, so the cell is
  // strictly wider than the icon-sized surface it paints.
  expect(geometry.cellWidth).toBeGreaterThan(geometry.surfaceWidth);
  expect(geometry.surfaceWidth).toBe(geometry.surfaceHeight);
  expect(geometry.adjacentSeparation).toBeGreaterThan(0);

  // Hovering the cell's outer edge — the distributed space beside the icon,
  // not the icon itself — must still light the centred square.
  const cellBox = await page
    .locator(".canvas-grid:visible .grid-cell")
    .first()
    .boundingBox();
  if (!cellBox) throw new Error("Could not measure cell");
  await page.mouse.move(cellBox.x + 2, cellBox.y + cellBox.height / 2);

  const highlight = page
    .locator(".canvas-grid:visible .grid-cell-surface")
    .first();
  await expect(highlight).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  const highlightBox = await highlight.boundingBox();
  expect(highlightBox?.width).toBeCloseTo(geometry.surfaceWidth, 0);
});

test("accepts a drop on the space distributed into a cell, not just on the icon", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1280, height: 800 });
  await openNewTab(page, extensionId);

  const ids = await seedBookmarks(page, 4);
  await page.reload();
  await expect(page.getByText("Fit 00")).toBeVisible();

  const draggedId = ids[0];
  if (!draggedId) throw new Error("no seeded bookmark");

  const source = page.getByText("Fit 00");
  const sourceBox = await source.boundingBox();
  if (!sourceBox) throw new Error("Could not measure source icon");

  // Target the far-left sliver of an empty cell in the second row — inside the
  // cell but outside the icon-sized surface, i.e. the distributed space.
  const target = await page.evaluate(() => {
    const grid = Array.from(document.querySelectorAll(".canvas-grid")).find(
      (candidate) => (candidate as HTMLElement).style.display !== "none",
    );
    if (!grid) throw new Error("no visible canvas grid");
    const cols = Number(
      /repeat\((\d+),/.exec(
        (grid as HTMLElement).style.gridTemplateColumns,
      )?.[1] ?? 0,
    );
    const cells = grid.querySelectorAll(".grid-cell");
    // First cell of the second row: empty, and far from the dragged icon.
    const cell = cells[cols];
    if (!cell) throw new Error("no second-row cell");
    const cellRect = cell.getBoundingClientRect();
    const surfaceRect = cell
      .querySelector(".grid-cell-surface")!
      .getBoundingClientRect();
    return {
      x: cellRect.left + (surfaceRect.left - cellRect.left) / 2,
      y: cellRect.top + cellRect.height / 2,
      insetFromSurface: surfaceRect.left - cellRect.left,
      row: 1,
      col: 0,
    };
  });

  // Guard the premise: if there were no distributed space, this test would be
  // dropping straight onto the icon and proving nothing.
  expect(target.insetFromSurface).toBeGreaterThan(1);

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await page.mouse.up();

  await expect
    .poll(async () => {
      const stored = (await page.evaluate(() =>
        chrome.storage.local.get("positions"),
      )) as {
        positions?: Record<
          string,
          Record<string, { page: number; row: number; col: number }>
        >;
      };
      const cell = stored.positions?.["1"]?.[draggedId];
      return cell ? { row: cell.row, col: cell.col } : null;
    })
    .toEqual({ row: target.row, col: target.col });
});
