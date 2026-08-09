import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { installResizeObserverMock } from "../../test/resizeObserverMock";
import { DndTestProvider } from "../../test/DndTestProvider";
import { setBookmarkPositions } from "../../lib/storage/positions";
import { Canvas } from "./Canvas";

const mock = installChromeMock();
const resizeMock = installResizeObserverMock();

/** Canvas relies on useDndMonitor, which requires a DndContext ancestor — in the real app that's provided by App. */
function renderCanvas(folderId: string) {
  return render(
    <DndTestProvider>
      <Canvas folderId={folderId} />
    </DndTestProvider>,
  );
}

function bookmarkNode(
  id: string,
  parentId: string,
  index: number,
): chrome.bookmarks.BookmarkTreeNode {
  return {
    id,
    parentId,
    index,
    title: `Bookmark ${id}`,
    url: `https://example.com/${id}`,
    syncing: false,
  };
}

beforeEach(() => {
  mock.reset();
  resizeMock.reset();
});

/** Triggers the ResizeObserver callback for the canvas container once it's mounted. */
async function resizeCanvas(width: number, height: number) {
  const container = await waitFor(() => {
    const el = document.querySelector(".canvas");
    if (!el) throw new Error("canvas container not yet mounted");
    return el;
  });
  act(() => {
    resizeMock.trigger(container, { width, height });
  });
}

function folderNode(
  id: string,
  parentId: string,
): chrome.bookmarks.BookmarkTreeNode {
  return { id, parentId, index: 0, title: id, syncing: false };
}

describe("Canvas", () => {
  it("renders bookmarks from the folder, paginating once capacity is exceeded", async () => {
    // 10 bookmarks; below the 512px tier breakpoint -> 80px icons. Capacity
    // counts the 8px gaps and 8px padding: (400-16+8)/(80+8)=4 cols,
    // (200-16+8)/(80+8)=2 rows -> capacity 8 per page -> 2 pages (8 + 2).
    mock.addNode(folderNode("f1", "0"));
    for (let i = 0; i < 10; i++) {
      mock.addNode(bookmarkNode(`b${i}`, "f1", i));
    }

    renderCanvas("f1");
    await resizeCanvas(400, 200);

    await waitFor(() => {
      expect(screen.getByText("Bookmark b0")).toBeVisible();
    });
    expect(screen.getByText("Bookmark b7")).toBeVisible();
    // Every page is mounted so the dragged icon survives a page flip; page 2's
    // items are in the DOM but hidden until navigated to.
    expect(screen.getByText("Bookmark b8")).not.toBeVisible();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("navigates to the next page via the pagination controls", async () => {
    mock.addNode(folderNode("f1", "0"));
    for (let i = 0; i < 10; i++) {
      mock.addNode(bookmarkNode(`b${i}`, "f1", i));
    }
    const user = userEvent.setup();

    renderCanvas("f1");
    await resizeCanvas(400, 200);
    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Bookmark b8")).toBeVisible();
    // Page 1's items remain mounted but hidden after navigating to page 2.
    expect(screen.getByText("Bookmark b0")).not.toBeVisible();
  });

  it("navigates the current tab when a bookmark icon is clicked", async () => {
    mock.addNode(folderNode("f1", "0"));
    mock.addNode(bookmarkNode("b0", "f1", 0));
    const originalLocation = window.location;
    const assign = vi.fn();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, assign },
    });
    const user = userEvent.setup();

    renderCanvas("f1");
    await resizeCanvas(200, 100);

    const icon = await screen.findByText("Bookmark b0");
    await user.click(icon);

    expect(assign).toHaveBeenCalledWith("https://example.com/b0");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renders a full grid of droppable cells, including empty ones", async () => {
    mock.addNode(folderNode("f1", "0"));
    mock.addNode(bookmarkNode("b0", "f1", 0));

    renderCanvas("f1");
    await resizeCanvas(400, 200);
    // 400x200 below the 512px tier breakpoint -> 80px icons -> 4 cols x 2 rows
    // once the gaps and padding are counted -> 8 cells total.
    await waitFor(() => {
      expect(document.querySelectorAll(".grid-cell")).toHaveLength(8);
    });
  });

  it("sizes icons at the 106px tier between 512px and 1024px", async () => {
    mock.addNode(folderNode("f1", "0"));
    mock.addNode(bookmarkNode("b0", "f1", 0));

    renderCanvas("f1");
    await resizeCanvas(700, 106);

    await waitFor(() => {
      // (700-16+8)/(106+8)=6 cols, height fits under one cell -> 1 row.
      expect(document.querySelectorAll(".grid-cell")).toHaveLength(6);
      const surfaces = document.querySelectorAll(".grid-cell-surface");
      expect((surfaces[0] as HTMLElement).style.width).toBe("106px");
    });
  });

  it("sizes icons at the 166px tier at 1024px and wider", async () => {
    mock.addNode(folderNode("f1", "0"));
    mock.addNode(bookmarkNode("b0", "f1", 0));

    renderCanvas("f1");
    await resizeCanvas(1024, 166);

    await waitFor(() => {
      // (1024-16+8)/(166+8)=5 cols. The old gap-blind floor(1024/166)=6 asked
      // for a 6th column that needed 1044px to render, clipping it.
      expect(document.querySelectorAll(".grid-cell")).toHaveLength(5);
      const surfaces = document.querySelectorAll(".grid-cell-surface");
      expect((surfaces[0] as HTMLElement).style.width).toBe("166px");
    });
  });

  it("lets the column track drive cell width while the icon keeps its tier size", async () => {
    mock.addNode(folderNode("f1", "0"));
    mock.addNode(bookmarkNode("b0", "f1", 0));

    renderCanvas("f1");
    await resizeCanvas(1024, 166);

    await waitFor(() => {
      const grid = document.querySelector(".canvas-grid") as HTMLElement;
      // Space-absorbing tracks, floorless so a stale frame mid-sidebar-drag
      // compresses instead of overflowing.
      expect(grid.style.gridTemplateColumns).toBe("repeat(5, minmax(0, 1fr))");
      // Rows stay fixed — vertical leftover is left below the last row.
      expect(grid.style.gridTemplateRows).toBe("repeat(1, 166px)");
      // The cell takes its width from the track, not from an inline style.
      const cell = document.querySelector(".grid-cell") as HTMLElement;
      expect(cell.style.width).toBe("");
      expect(cell.style.height).toBe("166px");
    });
  });

  it("gives every cell a tier-sized highlight surface, including empty ones", async () => {
    mock.addNode(folderNode("f1", "0"));
    mock.addNode(bookmarkNode("b0", "f1", 0));

    renderCanvas("f1");
    await resizeCanvas(1024, 166);

    await waitFor(() => {
      const surfaces = document.querySelectorAll(".grid-cell-surface");
      // One per cell — empty cells need one too, since a drag over an empty
      // cell highlights it as a drop target.
      expect(surfaces).toHaveLength(5);
      for (const surface of surfaces) {
        expect((surface as HTMLElement).style.width).toBe("166px");
      }
    });
  });

  it("marks bookmark icons as draggable", async () => {
    mock.addNode(folderNode("f1", "0"));
    mock.addNode(bookmarkNode("b0", "f1", 0));

    renderCanvas("f1");
    await resizeCanvas(200, 100);

    const icon = (await screen.findByText("Bookmark b0")).closest("button");
    expect(icon).toHaveAttribute("aria-roledescription", "draggable");
  });

  it("does not paginate when everything fits on one page", async () => {
    mock.addNode(folderNode("f1", "0"));
    mock.addNode(bookmarkNode("b0", "f1", 0));
    mock.addNode(bookmarkNode("b1", "f1", 1));

    renderCanvas("f1");
    await resizeCanvas(200, 100);

    await waitFor(() => {
      expect(screen.getByText("Bookmark b0")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Canvas pages")).not.toBeInTheDocument();
  });

  it("live-updates positions when changed from another tab", async () => {
    mock.addNode(folderNode("f1", "0"));
    mock.addNode(bookmarkNode("b0", "f1", 0));
    mock.addNode(bookmarkNode("b1", "f1", 1));

    renderCanvas("f1");
    await resizeCanvas(200, 100);

    await waitFor(() => {
      const labels = screen
        .getAllByText(/Bookmark b/)
        .map((el) => el.textContent);
      expect(labels).toEqual(["Bookmark b0", "Bookmark b1"]);
    });

    // Simulates another open new-tab page swapping these two bookmarks'
    // positions, not a drag within this Canvas instance.
    await setBookmarkPositions("f1", [
      { bookmarkId: "b0", slot: 1 },
      { bookmarkId: "b1", slot: 0 },
    ]);

    await waitFor(() => {
      const labels = screen
        .getAllByText(/Bookmark b/)
        .map((el) => el.textContent);
      expect(labels).toEqual(["Bookmark b1", "Bookmark b0"]);
    });
  });

  it("live-updates a bookmark's title on a chrome.bookmarks structure event, without any drag", async () => {
    mock.addNode(folderNode("f1", "0"));
    const bookmark = bookmarkNode("b0", "f1", 0);
    mock.addNode(bookmark);

    renderCanvas("f1");
    await resizeCanvas(200, 100);
    await waitFor(() => {
      expect(screen.getByText("Bookmark b0")).toBeInTheDocument();
    });

    // Simulates a rename via Chrome's native bookmark manager (or another
    // open new-tab page), not any action within this Canvas instance.
    const renamed = { ...bookmark, title: "Renamed Bookmark" };
    mock.addNode(renamed);
    mock.chrome.bookmarks.onChanged.emit("b0", { title: "Renamed Bookmark" });

    expect(await screen.findByText("Renamed Bookmark")).toBeInTheDocument();
    expect(screen.queryByText("Bookmark b0")).not.toBeInTheDocument();
  });

  describe("horizontal wheel pagination", () => {
    /**
     * Dispatches a real WheelEvent at the canvas container. The listener is
     * registered imperatively (non-passive), so this goes through
     * dispatchEvent rather than any React synthetic path — and the returned
     * event carries whether the default was prevented.
     */
    function wheelOverCanvas(init: WheelEventInit): WheelEvent {
      const container = document.querySelector(".canvas");
      if (!container) throw new Error("canvas container not mounted");
      const event = new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        ...init,
      });
      act(() => {
        container.dispatchEvent(event);
      });
      return event;
    }

    async function renderTwoPageFolder() {
      mock.addNode(folderNode("f1", "0"));
      for (let i = 0; i < 10; i++) {
        mock.addNode(bookmarkNode(`b${i}`, "f1", i));
      }
      renderCanvas("f1");
      await resizeCanvas(400, 200);
      await waitFor(() => {
        expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
      });
    }

    it("advances to the next page on rightward wheel input", async () => {
      await renderTwoPageFolder();

      wheelOverCanvas({ deltaX: 100 });

      expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
      expect(screen.getByText("Bookmark b8")).toBeVisible();
    });

    it("returns to the previous page on leftward wheel input", async () => {
      const user = userEvent.setup();
      await renderTwoPageFolder();
      await user.click(screen.getByRole("button", { name: "Next page" }));
      expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();

      wheelOverCanvas({ deltaX: -100 });

      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });

    it("does not change page on vertical wheel input", async () => {
      await renderTwoPageFolder();

      wheelOverCanvas({ deltaY: 400 });

      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });

    it("does not wrap past the last page", async () => {
      const user = userEvent.setup();
      await renderTwoPageFolder();
      await user.click(screen.getByRole("button", { name: "Next page" }));

      wheelOverCanvas({ deltaX: 100 });

      expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    });

    it("does not wrap before the first page", async () => {
      await renderTwoPageFolder();

      wheelOverCanvas({ deltaX: -100 });

      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });

    // The listener must be registered non-passive; under a passive listener
    // preventDefault is a silent no-op and Chrome's horizontal-overscroll
    // gesture would navigate the new-tab page backwards in history. jsdom
    // honours passive semantics, so defaultPrevented catches that regression.
    it("prevents the browser default on horizontal wheel input", async () => {
      await renderTwoPageFolder();

      const event = wheelOverCanvas({ deltaX: 100 });

      expect(event.defaultPrevented).toBe(true);
    });

    it("prevents the browser default even where no page change results", async () => {
      await renderTwoPageFolder();

      // At the first page, leftward input turns nothing — but an unprevented
      // horizontal overscroll here is exactly what triggers history-back.
      const event = wheelOverCanvas({ deltaX: -100 });

      expect(event.defaultPrevented).toBe(true);
    });

    it("leaves vertical wheel input un-prevented", async () => {
      await renderTwoPageFolder();

      const event = wheelOverCanvas({ deltaY: 400 });

      expect(event.defaultPrevented).toBe(false);
    });

    it("ignores wheel input in a folder that fits on a single page", async () => {
      mock.addNode(folderNode("f1", "0"));
      mock.addNode(bookmarkNode("b0", "f1", 0));
      renderCanvas("f1");
      await resizeCanvas(400, 200);
      await waitFor(() => {
        expect(screen.getByText("Bookmark b0")).toBeVisible();
      });

      const event = wheelOverCanvas({ deltaX: 100 });

      expect(screen.queryByText(/Page \d+ of/)).not.toBeInTheDocument();
      expect(event.defaultPrevented).toBe(true);
    });
  });
});
