import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";

/**
 * A window resize must never change a stored position.
 *
 * The bug these cover: growing the column count used to densely repack stored
 * positions, so a bookmark the user had dragged to a specific cell came back
 * somewhere else — usually at the end of the pack — once the window returned to
 * the size it was arranged at. Whether it survived depended on incidentals
 * (a reload, a folder switch, another tab, momentarily overshooting the width),
 * which is why the loss looked intermittent.
 */

interface StoredPositions {
  positions?: Record<string, Record<string, number>>;
}

/** Chrome's own titles for the protected roots, as the sidebar renders them. */
const BOOKMARKS_BAR = "Bookmarks bar";
const OTHER_BOOKMARKS = "Other bookmarks";

function newTabUrl(extensionId: string): string {
  return `chrome-extension://${extensionId}/src/newtab/index.html`;
}

async function readSlot(page: Page, bookmarkId: string) {
  const stored = (await page.evaluate(() =>
    chrome.storage.local.get("positions"),
  )) as StoredPositions;
  return stored.positions?.["1"]?.[bookmarkId];
}

/**
 * Cells the currently rendered page holds — the grid's real capacity.
 *
 * Returns 0 rather than throwing while no grid is mounted (the canvas renders a
 * loading state instead of its grids until the folder's bookmarks arrive).
 * `expect.poll` propagates a thrown callback instead of retrying it, so a
 * transient loading frame would otherwise fail a poll outright.
 */
async function measureCellsPerPage(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      document.querySelector(".canvas-grid")?.querySelectorAll(".grid-cell")
        .length ?? 0,
  );
}

/**
 * Waits for the canvas to actually render its grid.
 *
 * Deliberately not `[data-folder-id]`: that attribute is on the canvas element,
 * which is present during the loading state too, so waiting on it would let a
 * measurement run before any grid exists.
 */
async function waitForGrid(page: Page) {
  await expect(page.locator(".canvas-grid").first()).toBeVisible();
}

/**
 * Waits until a rendered grid holds a different number of cells than before.
 *
 * Asserted as a positive predicate rather than `poll(...).not.toBe(previous)`,
 * because the no-grid measurement of 0 would satisfy a bare "not equal" and let
 * the guard pass without the grid ever having changed.
 */
async function expectCellsPerPageToChangeFrom(page: Page, previous: number) {
  await expect
    .poll(async () => {
      const cells = await measureCellsPerPage(page);
      return cells > 0 && cells !== previous;
    })
    .toBe(true);
}

/**
 * Creates bookmarks in the Bookmarks Bar and waits for the service worker to
 * finish auto-placing every one of them. Acting earlier races a storage write
 * that would land mid-assertion.
 */
async function seedBookmarks(page: Page, titles: string[]): Promise<string[]> {
  const ids = await page.evaluate(async (names) => {
    const created: string[] = [];
    for (const title of names) {
      const node = await chrome.bookmarks.create({
        parentId: "1",
        title,
        url: `https://example.com/${encodeURIComponent(title)}`,
      });
      created.push(node.id);
    }
    return created;
  }, titles);

  await page.evaluate(async (created) => {
    const allPlaced = async () => {
      const stored = (await chrome.storage.local.get("positions")) as {
        positions?: Record<string, Record<string, unknown>>;
      };
      const folder = stored.positions?.["1"] ?? {};
      return created.every((id) => id in folder);
    };
    while (!(await allPlaced())) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }, ids);

  return ids;
}

/** Drags `title`'s icon onto the empty grid cell at `cellIndex` of the current page. */
async function dragToCell(page: Page, title: string, cellIndex: number) {
  const icon = page.getByText(title);
  await expect(icon).toBeVisible();
  const iconBox = await icon.boundingBox();
  const target = await page.evaluate((index) => {
    const grid = document.querySelector(".canvas-grid");
    const cell = grid?.querySelectorAll(".grid-cell")[index];
    if (!cell) throw new Error(`no grid cell at index ${index}`);
    const rect = cell.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }, cellIndex);
  if (!iconBox) throw new Error(`could not measure the icon for ${title}`);

  await page.mouse.move(
    iconBox.x + iconBox.width / 2,
    iconBox.y + iconBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 10 });
  await page.mouse.up();
}

/** The icon's position relative to the canvas, so it survives viewport changes. */
async function iconOffsetInCanvas(page: Page, title: string) {
  const canvasBox = await page.locator(".canvas").boundingBox();
  const iconBox = await page.getByText(title).boundingBox();
  if (!canvasBox || !iconBox) throw new Error("could not measure the canvas");
  return {
    x: Math.round(iconBox.x - canvasBox.x),
    y: Math.round(iconBox.y - canvasBox.y),
  };
}

const WIDE = { width: 1400, height: 900 };
const NARROW = { width: 760, height: 620 };
const WIDER_STILL = { width: 1800, height: 1100 };

/**
 * Seeds three bookmarks at WIDE, drags "Pinned" to a cell in the second row
 * (leaving a deliberate gap before it), and returns its id, stored slot, and
 * on-screen offset.
 */
async function arrangeAtWide(page: Page) {
  const [, , pinnedId] = await seedBookmarks(page, [
    "Resize First",
    "Resize Second",
    "Resize Pinned",
  ]);
  await page.reload();
  await waitForGrid(page);

  const cols = await page.evaluate(() => {
    const grid = document.querySelector(".canvas-grid") as HTMLElement | null;
    return Number(
      /repeat\((\d+),/.exec(grid?.style.gridTemplateColumns ?? "")?.[1] ?? 0,
    );
  });
  // Second row, a few columns in: far enough from the seeded run to leave a gap.
  await dragToCell(page, "Resize Pinned", cols + 3);

  // The drop persists asynchronously, so poll rather than reading straight away.
  const slot = cols + 3;
  await expect.poll(() => readSlot(page, pinnedId!)).toBe(slot);
  return {
    pinnedId: pinnedId!,
    slot,
    offset: await iconOffsetInCanvas(page, "Resize Pinned"),
  };
}

test("a bookmark returns to the exact cell it was dragged to after a resize round trip", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize(WIDE);
  await page.goto(newTabUrl(extensionId));

  const arranged = await arrangeAtWide(page);
  const wideCellsPerPage = await measureCellsPerPage(page);

  await page.setViewportSize(NARROW);
  // Guard the premise: the excursion must really change the grid.
  await expectCellsPerPageToChangeFrom(page, wideCellsPerPage);

  await page.setViewportSize(WIDE);
  await expect.poll(() => measureCellsPerPage(page)).toBe(wideCellsPerPage);

  expect(await readSlot(page, arranged.pinnedId)).toBe(arranged.slot);
  expect(await iconOffsetInCanvas(page, "Resize Pinned")).toEqual(
    arranged.offset,
  );
});

test("overshooting to a wider window on the way back is not destructive", async ({
  context,
  extensionId,
}) => {
  // Column growth is what used to rewrite storage, so passing through a wider
  // size than the one the bookmark was arranged at was enough to lose it.
  const page = await context.newPage();
  await page.setViewportSize(WIDE);
  await page.goto(newTabUrl(extensionId));

  const arranged = await arrangeAtWide(page);
  const wideCellsPerPage = await measureCellsPerPage(page);

  await page.setViewportSize(NARROW);
  await page.setViewportSize(WIDER_STILL);
  await expect
    .poll(() => measureCellsPerPage(page))
    .toBeGreaterThan(wideCellsPerPage);

  await page.setViewportSize(WIDE);
  await expect.poll(() => measureCellsPerPage(page)).toBe(wideCellsPerPage);

  expect(await readSlot(page, arranged.pinnedId)).toBe(arranged.slot);
  expect(await iconOffsetInCanvas(page, "Resize Pinned")).toEqual(
    arranged.offset,
  );
});

test("a reload at the other size does not disturb the arrangement", async ({
  context,
  extensionId,
}) => {
  // Reloading used to re-base the growth baseline onto the smaller size, which
  // made the next widening a repack.
  const page = await context.newPage();
  await page.setViewportSize(WIDE);
  await page.goto(newTabUrl(extensionId));

  const arranged = await arrangeAtWide(page);
  const wideCellsPerPage = await measureCellsPerPage(page);

  await page.setViewportSize(NARROW);
  await page.reload();
  await waitForGrid(page);

  await page.setViewportSize(WIDE);
  await expect.poll(() => measureCellsPerPage(page)).toBe(wideCellsPerPage);

  expect(await readSlot(page, arranged.pinnedId)).toBe(arranged.slot);
  expect(await iconOffsetInCanvas(page, "Resize Pinned")).toEqual(
    arranged.offset,
  );
});

test("switching folders at the other size does not disturb the arrangement", async ({
  context,
  extensionId,
}) => {
  // Selecting a folder used to reset the per-folder growth baseline.
  const page = await context.newPage();
  await page.setViewportSize(WIDE);
  await page.goto(newTabUrl(extensionId));

  const arranged = await arrangeAtWide(page);
  const wideCellsPerPage = await measureCellsPerPage(page);

  // A protected root, so it is always present in the sidebar without needing
  // any parent row expanded.
  await page.setViewportSize(NARROW);
  await page
    .getByRole("button", { name: OTHER_BOOKMARKS, exact: true })
    .click();
  await expect(page.locator('[data-folder-id="2"]')).toBeVisible();
  await waitForGrid(page);
  await page.getByRole("button", { name: BOOKMARKS_BAR, exact: true }).click();
  await expect(page.locator('[data-folder-id="1"]')).toBeVisible();
  // The switch must finish at the narrow size — that is what the test is about.
  await expect(page.getByText("Resize Pinned")).toBeVisible();

  await page.setViewportSize(WIDE);
  await expect.poll(() => measureCellsPerPage(page)).toBe(wideCellsPerPage);

  expect(await readSlot(page, arranged.pinnedId)).toBe(arranged.slot);
  expect(await iconOffsetInCanvas(page, "Resize Pinned")).toEqual(
    arranged.offset,
  );
});

test("a second tab at a different size does not disturb the first tab's layout", async ({
  context,
  extensionId,
}) => {
  // Each tab used to hold its own growth baseline, so a tab that had never seen
  // the wide size would repack the store the moment it grew.
  const pageA = await context.newPage();
  await pageA.setViewportSize(WIDE);
  await pageA.goto(newTabUrl(extensionId));

  const arranged = await arrangeAtWide(pageA);

  const pageB = await context.newPage();
  await pageB.setViewportSize(NARROW);
  await pageB.goto(newTabUrl(extensionId));
  await waitForGrid(pageB);
  await expect(pageB.getByText("Resize Pinned")).toBeVisible();

  await pageA.bringToFront();
  expect(await readSlot(pageA, arranged.pinnedId)).toBe(arranged.slot);
  expect(await iconOffsetInCanvas(pageA, "Resize Pinned")).toEqual(
    arranged.offset,
  );
});

test("an empty cell between bookmarks survives a resize round trip", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize(WIDE);
  await page.goto(newTabUrl(extensionId));

  const arranged = await arrangeAtWide(page);
  const wideCellsPerPage = await measureCellsPerPage(page);

  // The drag left slots 2..(cols+2) unassigned; the gap is part of the
  // arrangement and must reflow with it rather than being squeezed out.
  const gapBefore = await page.evaluate(() => {
    const grid = document.querySelector(".canvas-grid");
    const cells = [...(grid?.querySelectorAll(".grid-cell") ?? [])];
    return cells.map((cell) => cell.classList.contains("grid-cell--occupied"));
  });

  await page.setViewportSize(NARROW);
  await page.setViewportSize(WIDE);
  await expect.poll(() => measureCellsPerPage(page)).toBe(wideCellsPerPage);

  const gapAfter = await page.evaluate(() => {
    const grid = document.querySelector(".canvas-grid");
    const cells = [...(grid?.querySelectorAll(".grid-cell") ?? [])];
    return cells.map((cell) => cell.classList.contains("grid-cell--occupied"));
  });

  expect(gapAfter).toEqual(gapBefore);
  expect(await readSlot(page, arranged.pinnedId)).toBe(arranged.slot);
});
