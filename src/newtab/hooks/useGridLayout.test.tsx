import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { installResizeObserverMock } from "../../test/resizeObserverMock";
import { DndTestProvider } from "../../test/DndTestProvider";
import { STORAGE_KEYS } from "../../lib/storage/schema";
import { useGridLayout } from "./useGridLayout";

const mock = installChromeMock();
const resizeMock = installResizeObserverMock();

beforeEach(() => {
  mock.reset();
  resizeMock.reset();
});

/**
 * Renders the hook and exposes both the derived capacity and the full layout as
 * text, so a test can drive resizes and read back exactly where each bookmark
 * is displayed.
 */
function Harness() {
  const { containerRef, capacity, pages } = useGridLayout("f1");
  const layout = pages
    .flatMap((page) =>
      page.map(
        (entry) =>
          `${entry.bookmarkId}@${entry.cell.page},${entry.cell.row},${entry.cell.col}`,
      ),
    )
    .join(" ");
  return (
    <div ref={containerRef} data-testid="canvas">
      <span data-testid="capacity">{`${capacity.cols}x${capacity.rows}`}</span>
      <span data-testid="layout">{layout}</span>
    </div>
  );
}

function renderHarness() {
  render(
    <DndTestProvider>
      <Harness />
    </DndTestProvider>,
  );
  return screen.getByTestId("canvas");
}

/** Lets the hook's async storage effects settle. */
async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
  await act(async () => {
    await Promise.resolve();
  });
}

async function resize(canvas: Element, width: number, height: number) {
  await act(async () => {
    resizeMock.trigger(canvas, { width, height });
  });
  await settle();
}

function layout(): string {
  return screen.getByTestId("layout").textContent ?? "";
}

function capacity(): string {
  return screen.getByTestId("capacity").textContent ?? "";
}

/** Seeds a folder of bookmarks that already hold the given slots. */
async function seedFolder(slots: Record<string, number>) {
  let index = 0;
  for (const id of Object.keys(slots)) {
    mock.addNode({
      id,
      parentId: "f1",
      index: index++,
      title: `Bookmark ${id}`,
      url: `https://example.com/${id}`,
      syncing: false,
    });
  }
  await mock.chrome.storage.local.set({
    [STORAGE_KEYS.POSITIONS]: { f1: slots },
  });
}

/** Counts writes to a storage key from now until the returned stop() is called. */
function countWritesTo(key: string) {
  let writes = 0;
  const listener = (
    changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  ) => {
    if (key in changes) writes += 1;
  };
  mock.chrome.storage.onChanged.addListener(listener);
  return {
    stop() {
      mock.chrome.storage.onChanged.removeListener(listener);
      return writes;
    },
  };
}

describe("a window resize never writes stored positions", () => {
  it("performs no write to the positions key across any number of resizes", async () => {
    await seedFolder({ a: 0, b: 1, pinned: 17 });
    const canvas = renderHarness();
    await resize(canvas, 1600, 900);

    // Count only what the resizes themselves do, after first-run seeding.
    const counter = countWritesTo(STORAGE_KEYS.POSITIONS);

    await resize(canvas, 700, 500);
    await resize(canvas, 2000, 1200);
    await resize(canvas, 400, 300);
    await resize(canvas, 1600, 900);

    expect(counter.stop()).toBe(0);
  });

  it("no longer publishes a measured grid capacity", async () => {
    await seedFolder({ a: 0 });
    const canvas = renderHarness();
    await resize(canvas, 1600, 900);

    const counter = countWritesTo(STORAGE_KEYS.GRID_CAPACITY);
    await resize(canvas, 700, 500);
    await resize(canvas, 1600, 900);

    // Placement is capacity-free, so there is nothing left to publish.
    expect(counter.stop()).toBe(0);
  });
});

describe("returning to a window size restores the layout exactly", () => {
  it("restores every bookmark after shrinking away and back", async () => {
    await seedFolder({ a: 0, b: 1, pinned: 17 });
    const canvas = renderHarness();

    await resize(canvas, 1600, 900);
    const original = layout();
    const originalCapacity = capacity();

    await resize(canvas, 500, 400);
    expect(layout()).not.toBe(original);

    await resize(canvas, 1600, 900);
    expect(capacity()).toBe(originalCapacity);
    expect(layout()).toBe(original);
  });

  it("restores every bookmark after growing past the size it was arranged at", async () => {
    // The reported bug: growing used to densely repack stored positions, so the
    // pinned bookmark came back at the end of the pack instead of its own cell.
    await seedFolder({ a: 0, b: 1, pinned: 17 });
    const canvas = renderHarness();

    await resize(canvas, 1000, 700);
    const original = layout();
    const originalCapacity = capacity();

    await resize(canvas, 2000, 1400);
    // Guards the test against going vacuous: the excursion must really widen
    // the grid, since it is column growth that used to rewrite storage.
    expect(capacity()).not.toBe(originalCapacity);

    await resize(canvas, 1000, 700);
    expect(layout()).toBe(original);
  });

  it("survives a folder switch at another size", async () => {
    // previousCapacityRef used to be reset here, re-basing growth detection on
    // the smaller size and making the next widening destructive.
    await seedFolder({ a: 0, b: 1, pinned: 17 });
    const canvas = renderHarness();

    await resize(canvas, 1600, 900);
    const original = layout();

    await resize(canvas, 600, 400);
    await resize(canvas, 1600, 900);

    expect(layout()).toBe(original);
  });

  it("keeps an unassigned slot as a gap rather than closing it", async () => {
    // a, b, then a gap at slot 2, then pinned at 3.
    await seedFolder({ a: 0, b: 1, pinned: 3 });
    const canvas = renderHarness();

    await resize(canvas, 1600, 900);
    const original = layout();
    expect(original).toContain("pinned@0,0,3");

    await resize(canvas, 500, 400);
    await resize(canvas, 1600, 900);

    // The gap is still there and pinned is still on the far side of it.
    expect(layout()).toBe(original);
    expect(layout()).toContain("pinned@0,0,3");
  });
});
