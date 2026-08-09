import type { Locator, Page } from "@playwright/test";
import { test, expect } from "./fixtures";

async function dragBetween(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}

function rowFor(page: Page, title: string): Locator {
  return page.locator(".folder-row", {
    has: page.getByRole("button", { name: title, exact: true }),
  });
}

async function boxOf(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Could not measure element");
  return box;
}

/**
 * The centre of the "insert before this row" gap, which straddles the row's
 * top edge (5px either side). Grabbing the row's own box rather than its label
 * button, since the gap is positioned against the row.
 */
async function gapBefore(page: Page, title: string) {
  const box = await boxOf(rowFor(page, title));
  return { x: box.x + box.width / 2, y: box.y };
}

/**
 * A point inside a row's gap strip *and* inside the row's own drop target.
 *
 * The row's droppable is its label button, which the row's 3px padding insets
 * from the row box, while the gap straddles the row box's top edge — so the
 * two overlap only in a narrow band. Used to prove that a gap declining a drop
 * lets the pointer fall through to the row beneath, which needs a point where
 * the row is actually a candidate.
 */
async function gapOverlappingRow(page: Page, title: string) {
  const rowBox = await boxOf(rowFor(page, title));
  const buttonBox = await boxOf(
    page.getByRole("button", { name: title, exact: true }),
  );
  const y = buttonBox.y + 1;
  // Guards the assumption above: if the gap's height or the row's padding
  // changes, this fails loudly here rather than silently testing nothing.
  expect(y).toBeLessThanOrEqual(rowBox.y + 5);
  return { x: buttonBox.x + buttonBox.width / 2, y };
}

/**
 * The centre of a row's grab area, used as a drag origin.
 */
async function rowCentre(page: Page, title: string) {
  const box = await boxOf(
    page.getByRole("button", { name: title, exact: true }),
  );
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Titles of every folder row currently rendered, in visual order. */
async function renderedOrder(page: Page, among: string[]) {
  const labels = await page.locator(".folder-label").allTextContents();
  return labels.filter((label) => among.includes(label));
}

async function childTitles(page: Page, parentId: string, among: string[]) {
  const titles = await page.evaluate(async (id) => {
    const children = await chrome.bookmarks.getChildren(id);
    return children.map((child) => child.title);
  }, parentId);
  return titles.filter((title) => among.includes(title));
}

async function expandRow(page: Page, title: string) {
  await rowFor(page, title)
    .getByRole("button", { name: "Expand folder" })
    .click();
}

test("dropping a folder into a gap reorders it among its siblings", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  await page.evaluate(async () => {
    for (const title of ["Ord One", "Ord Two", "Ord Three"]) {
      await chrome.bookmarks.create({ parentId: "1", title });
    }
  });
  await page.reload();
  await expandRow(page, "Bookmarks bar");

  const names = ["Ord One", "Ord Two", "Ord Three"];
  await expect(
    page.getByRole("button", { name: "Ord Three", exact: true }),
  ).toBeVisible();
  expect(await childTitles(page, "1", names)).toEqual(names);

  // Drag the third folder onto the gap above the first.
  await dragBetween(
    page,
    await rowCentre(page, "Ord Three"),
    await gapBefore(page, "Ord One"),
  );

  await expect
    .poll(() => childTitles(page, "1", names))
    .toEqual(["Ord Three", "Ord One", "Ord Two"]);
  // Polled, not asserted once: the bookmarks API reflects the move before the
  // sidebar does, since the sidebar re-renders off the onMoved refetch.
  await expect
    .poll(() => renderedOrder(page, names))
    .toEqual(["Ord Three", "Ord One", "Ord Two"]);

  // The parent is untouched — this reorders, it does not reparent.
  const parentId = await page.evaluate(async () => {
    const [node] = await chrome.bookmarks.search({ title: "Ord Three" });
    return node?.parentId;
  });
  expect(parentId).toBe("1");
});

test("the end gap sits below an expanded sibling's whole subtree", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const parentId = await page.evaluate(async () => {
    const parent = await chrome.bookmarks.create({
      parentId: "1",
      title: "End Parent",
    });
    // Order matters: "End First" is dragged to the end, past "End Last",
    // whose own expanded child is what the end gap must appear below.
    await chrome.bookmarks.create({ parentId: parent.id, title: "End First" });
    const last = await chrome.bookmarks.create({
      parentId: parent.id,
      title: "End Last",
    });
    await chrome.bookmarks.create({ parentId: last.id, title: "End Nested" });
    return parent.id;
  });
  await page.reload();
  await expandRow(page, "Bookmarks bar");
  await expandRow(page, "End Parent");
  await expandRow(page, "End Last");

  const names = ["End First", "End Last"];
  await expect(
    page.getByRole("button", { name: "End Nested", exact: true }),
  ).toBeVisible();
  expect(await childTitles(page, parentId, names)).toEqual(names);

  // The end gap straddles the bottom edge of the last sibling's *subtree*,
  // i.e. below the nested row — not below "End Last"'s own row.
  const nestedBox = await boxOf(rowFor(page, "End Nested"));
  await dragBetween(page, await rowCentre(page, "End First"), {
    x: nestedBox.x + nestedBox.width / 2,
    y: nestedBox.y + nestedBox.height,
  });

  await expect
    .poll(() => childTitles(page, parentId, names))
    .toEqual(["End Last", "End First"]);
});

test("reordering maps the visible slot to the right index when bookmarks are interleaved", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const parentId = await page.evaluate(async () => {
    const parent = await chrome.bookmarks.create({
      parentId: "1",
      title: "Mixed Parent",
    });
    // children: [bookmark] [Mixed A] [bookmark] [Mixed B]
    await chrome.bookmarks.create({
      parentId: parent.id,
      title: "Mixed Link 1",
      url: "https://example.com/1",
    });
    await chrome.bookmarks.create({ parentId: parent.id, title: "Mixed A" });
    await chrome.bookmarks.create({
      parentId: parent.id,
      title: "Mixed Link 2",
      url: "https://example.com/2",
    });
    await chrome.bookmarks.create({ parentId: parent.id, title: "Mixed B" });
    return parent.id;
  });
  await page.reload();
  await expandRow(page, "Bookmarks bar");
  await expandRow(page, "Mixed Parent");

  const folders = ["Mixed A", "Mixed B"];
  await expect(
    page.getByRole("button", { name: "Mixed B", exact: true }),
  ).toBeVisible();

  // Drag B above A. "Mixed A" is the 2nd child but the 1st visible subfolder;
  // anchoring to its visible position instead of its child index would put B
  // in the wrong place.
  await dragBetween(
    page,
    await rowCentre(page, "Mixed B"),
    await gapBefore(page, "Mixed A"),
  );

  await expect
    .poll(() => childTitles(page, parentId, folders))
    .toEqual(["Mixed B", "Mixed A"]);

  // The bookmarks are still there, and still in their original relative order.
  expect(
    await childTitles(page, parentId, ["Mixed Link 1", "Mixed Link 2"]),
  ).toEqual(["Mixed Link 1", "Mixed Link 2"]);
});

test("reordering folders changes no stored canvas position", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  await page.evaluate(async () => {
    for (const title of ["Pos One", "Pos Two"]) {
      const folder = await chrome.bookmarks.create({ parentId: "1", title });
      await chrome.bookmarks.create({
        parentId: folder.id,
        title: `${title} link`,
        url: `https://example.com/${title}`,
      });
    }
  });
  await page.reload();
  await expandRow(page, "Bookmarks bar");
  await expect(
    page.getByRole("button", { name: "Pos Two", exact: true }),
  ).toBeVisible();

  // Let the initial placement settle before snapshotting.
  //
  // These bookmarks live inside Pos One / Pos Two while the page shows the
  // Bookmarks bar, so they never reach the canvas and the page's own backfill
  // never places them — the service worker's onCreated handler is the only
  // writer. That wait gets the same budget position-write-concurrency.spec.ts
  // gives it (15s, polled every 250ms) rather than the 5s/10s default: on a
  // loaded runner the SW takes seconds to wake and place, and the default
  // expires mid-placement.
  await expect
    .poll(
      async () =>
        page.evaluate(async () => {
          const stored = await chrome.storage.local.get("positions");
          return Object.keys(
            (stored as { positions?: Record<string, unknown> }).positions ?? {},
          ).length;
        }),
      { timeout: 15000, intervals: [250] },
    )
    .toBeGreaterThan(0);

  const before = await page.evaluate(async () => {
    const stored = await chrome.storage.local.get("positions");
    return JSON.stringify((stored as { positions?: unknown }).positions);
  });

  await dragBetween(
    page,
    await rowCentre(page, "Pos Two"),
    await gapBefore(page, "Pos One"),
  );

  await expect
    .poll(() => childTitles(page, "1", ["Pos One", "Pos Two"]))
    .toEqual(["Pos Two", "Pos One"]);

  const after = await page.evaluate(async () => {
    const stored = await chrome.storage.local.get("positions");
    return JSON.stringify((stored as { positions?: unknown }).positions);
  });
  expect(after).toBe(before);
});

test("a bookmark released over a gap does not reorder anything", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  const { hostId, bookmarkId } = await page.evaluate(async () => {
    const host = await chrome.bookmarks.create({
      parentId: "1",
      title: "Gap Host",
    });
    await chrome.bookmarks.create({ parentId: "1", title: "Gap Other" });
    const bookmark = await chrome.bookmarks.create({
      parentId: host.id,
      title: "Gap Bookmark",
      url: "https://example.com/gap",
    });
    return { hostId: host.id, bookmarkId: bookmark.id };
  });
  await page.reload();
  await expandRow(page, "Bookmarks bar");

  const names = ["Gap Host", "Gap Other"];
  await page.getByRole("button", { name: "Gap Host", exact: true }).click();
  const icon = page.getByText("Gap Bookmark");
  await expect(icon).toBeVisible();

  const otherId = await page.evaluate(async () => {
    const [node] = await chrome.bookmarks.search({ title: "Gap Other" });
    return node?.id;
  });

  // Aim at the gap above "Gap Other" — deliberately a *different* folder from
  // the bookmark's own, so the outcome distinguishes three cases: a gap that
  // wrongly accepted the drop would reorder the folders; a drag that never
  // activated would leave the bookmark in "Gap Host"; and the correct
  // behaviour — the gap declining, so the pointer falls through to the row
  // beneath — moves the bookmark into "Gap Other".
  const iconBox = await boxOf(icon);
  await dragBetween(
    page,
    { x: iconBox.x + iconBox.width / 2, y: iconBox.y + iconBox.height / 2 },
    await gapOverlappingRow(page, "Gap Other"),
  );

  await expect
    .poll(async () => {
      const [node] = await page.evaluate(
        (id) => chrome.bookmarks.get(id),
        bookmarkId,
      );
      return node?.parentId;
    })
    .toBe(otherId);
  expect(otherId).not.toBe(hostId);

  // …and no folder was reordered along the way.
  expect(await childTitles(page, "1", names)).toEqual(names);
});

test("the insert line and the row highlight are never shown together", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/src/newtab/index.html`);

  await page.evaluate(async () => {
    for (const title of ["Vis One", "Vis Two", "Vis Three"]) {
      await chrome.bookmarks.create({ parentId: "1", title });
    }
    // A folder under a different parent, to check gaps there stay inert.
    const other = await chrome.bookmarks.create({
      parentId: "2",
      title: "Vis Other Parent",
    });
    await chrome.bookmarks.create({ parentId: other.id, title: "Vis Nested" });
  });
  await page.reload();
  await expandRow(page, "Bookmarks bar");
  await expandRow(page, "Other bookmarks");
  await expandRow(page, "Vis Other Parent");
  await expect(
    page.getByRole("button", { name: "Vis Nested", exact: true }),
  ).toBeVisible();

  const line = page.locator(".folder-drop-line");
  const highlightedRows = page.locator(".folder-row--over");

  // Grab "Vis Three" and hold it — every assertion below happens mid-drag.
  const origin = await rowCentre(page, "Vis Three");
  await page.mouse.move(origin.x, origin.y);
  await page.mouse.down();

  // Over a live gap: the insert line shows, and no row shows its wash.
  const liveGap = await gapBefore(page, "Vis One");
  await page.mouse.move(liveGap.x, liveGap.y, { steps: 5 });
  await expect(line).toBeVisible();
  await expect(highlightedRows).toHaveCount(0);

  const indentAtFirstGap = await line.evaluate(
    (el) => getComputedStyle(el).left,
  );
  // depth 1 row: 1 indent step (16px) + the expand-toggle column (16px).
  expect(indentAtFirstGap).toBe("32px");

  // A second live gap in the same parent: still one line, same indent.
  const secondGap = await gapBefore(page, "Vis Two");
  await page.mouse.move(secondGap.x, secondGap.y, { steps: 5 });
  await expect(line).toBeVisible();
  await expect(line).toHaveCount(1);
  expect(await line.evaluate((el) => getComputedStyle(el).left)).toBe(
    indentAtFirstGap,
  );

  // Over a gap belonging to a different parent: no line at all, and the row
  // beneath offers its normal reparent highlight instead.
  const foreignGap = await gapOverlappingRow(page, "Vis Nested");
  await page.mouse.move(foreignGap.x, foreignGap.y, { steps: 5 });
  await expect(line).toHaveCount(0);
  await expect(highlightedRows).toHaveCount(1);

  // Over the gap immediately above the dragged folder — a no-op slot, so it
  // must not light up either.
  const adjacentGap = await gapBefore(page, "Vis Three");
  await page.mouse.move(adjacentGap.x, adjacentGap.y, { steps: 5 });
  await expect(line).toHaveCount(0);

  await page.mouse.up();
});
