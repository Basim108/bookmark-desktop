import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import {
  DEFAULT_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  getSidebarWidth,
} from "../../lib/storage/sidebarSettings";
import { useSidebarResize } from "./useSidebarResize";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

function TestHandle() {
  const { width, isDragging, startDrag } = useSidebarResize();
  return (
    <div
      data-testid="handle"
      data-dragging={isDragging}
      onPointerDown={startDrag}
    >
      {width}
    </div>
  );
}

describe("useSidebarResize", () => {
  it("starts at the default width", async () => {
    render(<TestHandle />);
    await waitFor(() => {
      expect(screen.getByTestId("handle")).toHaveTextContent(
        String(DEFAULT_SIDEBAR_WIDTH),
      );
    });
  });

  it("follows the pointer while dragging and persists the width on release", async () => {
    render(<TestHandle />);
    const handle = await screen.findByTestId("handle");
    await waitFor(() =>
      expect(handle).toHaveTextContent(String(DEFAULT_SIDEBAR_WIDTH)),
    );

    fireEvent.pointerDown(handle, { clientX: 240 });
    expect(handle).toHaveAttribute("data-dragging", "true");

    fireEvent.pointerMove(window, { clientX: 290 });
    expect(handle).toHaveTextContent(String(DEFAULT_SIDEBAR_WIDTH + 50));

    fireEvent.pointerUp(window);
    expect(handle).toHaveAttribute("data-dragging", "false");

    await waitFor(async () => {
      expect(await getSidebarWidth()).toBe(DEFAULT_SIDEBAR_WIDTH + 50);
    });
  });

  it("clamps the width to the minimum while dragging past it", async () => {
    render(<TestHandle />);
    const handle = await screen.findByTestId("handle");
    await waitFor(() =>
      expect(handle).toHaveTextContent(String(DEFAULT_SIDEBAR_WIDTH)),
    );

    fireEvent.pointerDown(handle, { clientX: 240 });
    fireEvent.pointerMove(window, { clientX: -1000 });
    expect(handle).toHaveTextContent(String(MIN_SIDEBAR_WIDTH));

    fireEvent.pointerUp(window);
    await waitFor(async () => {
      expect(await getSidebarWidth()).toBe(MIN_SIDEBAR_WIDTH);
    });
  });
});
