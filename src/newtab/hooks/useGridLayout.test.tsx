import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { installResizeObserverMock } from "../../test/resizeObserverMock";
import { DndTestProvider } from "../../test/DndTestProvider";
import { getMeasuredGridCapacity } from "../../lib/storage/gridCapacity";
import { useGridLayout } from "./useGridLayout";

const mock = installChromeMock();
const resizeMock = installResizeObserverMock();

beforeEach(() => {
  mock.reset();
  resizeMock.reset();
});

/**
 * Renders the hook and exposes the measured capacity as text, so a test can
 * both drive resizes and read back what the hook derived from them.
 */
function Harness() {
  const { containerRef, capacity } = useGridLayout("1");
  return (
    <div
      ref={containerRef}
      data-testid="canvas"
    >{`${capacity.cols}x${capacity.rows}`}</div>
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
}

describe("useGridLayout capacity publishing", () => {
  it("does not publish a capacity before the canvas has been measured", async () => {
    renderHarness();
    await settle();

    // At 0x0 the sizing formula floors to its 1x1 minimum. Publishing that
    // would make the service worker place one bookmark per page.
    expect(await getMeasuredGridCapacity()).toBeUndefined();
  });

  it("publishes the capacity once the canvas reports a real size", async () => {
    const canvas = renderHarness();

    await act(async () => {
      resizeMock.trigger(canvas, { width: 1600, height: 900 });
    });
    await settle();

    const published = await getMeasuredGridCapacity();
    expect(published).toBeDefined();
    expect(published).toEqual({
      cols: Number(screen.getByTestId("canvas").textContent?.split("x")[0]),
      rows: Number(screen.getByTestId("canvas").textContent?.split("x")[1]),
    });
    // The whole point: bigger than the 6x4 bootstrap the SW used to assume.
    expect(published!.cols * published!.rows).toBeGreaterThan(24);
  });

  it("republishes when a resize changes the capacity", async () => {
    const canvas = renderHarness();

    await act(async () => {
      resizeMock.trigger(canvas, { width: 1600, height: 900 });
    });
    await settle();
    const wide = await getMeasuredGridCapacity();

    await act(async () => {
      resizeMock.trigger(canvas, { width: 700, height: 500 });
    });
    await settle();
    const narrow = await getMeasuredGridCapacity();

    expect(narrow).not.toEqual(wide);
    expect(narrow!.cols).toBeLessThan(wide!.cols);
  });

  it("does not rewrite the key when a resize leaves the capacity unchanged", async () => {
    const canvas = renderHarness();

    await act(async () => {
      resizeMock.trigger(canvas, { width: 1600, height: 900 });
    });
    await settle();

    let writes = 0;
    const listener = (
      changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
    ) => {
      if ("gridCapacity" in changes) writes += 1;
    };
    mock.chrome.storage.onChanged.addListener(listener);

    // A few pixels wider cannot cross a column boundary, so the derived
    // capacity is identical and nothing should be written.
    await act(async () => {
      resizeMock.trigger(canvas, { width: 1603, height: 900 });
    });
    await settle();

    mock.chrome.storage.onChanged.removeListener(listener);
    expect(writes).toBe(0);
  });
});
