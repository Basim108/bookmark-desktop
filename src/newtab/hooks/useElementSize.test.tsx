import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { installResizeObserverMock } from "../../test/resizeObserverMock";
import { useElementSize } from "./useElementSize";

const resizeMock = installResizeObserverMock();

beforeEach(() => {
  resizeMock.reset();
});

function TestComponent() {
  const { ref, size } = useElementSize<HTMLDivElement>();
  return <div ref={ref}>{`${size.width}x${size.height}`}</div>;
}

describe("useElementSize", () => {
  it("starts at 0x0 before any resize is observed", () => {
    render(<TestComponent />);
    expect(screen.getByText("0x0")).toBeInTheDocument();
  });

  it("updates when the observed element reports a new size", () => {
    render(<TestComponent />);
    const element = screen.getByText("0x0");

    act(() => {
      resizeMock.trigger(element, { width: 480, height: 320 });
    });

    expect(screen.getByText("480x320")).toBeInTheDocument();
  });
});
