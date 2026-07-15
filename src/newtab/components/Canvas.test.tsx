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
    // 10 bookmarks; below the 1660px tier breakpoint -> 80px icons ->
    // floor(320/80)=4 cols, floor(160/80)=2 rows -> capacity 8 per page ->
    // 2 pages (8 + 2).
    mock.addNode(folderNode("f1", "0"));
    for (let i = 0; i < 10; i++) {
      mock.addNode(bookmarkNode(`b${i}`, "f1", i));
    }

    renderCanvas("f1");
    await resizeCanvas(320, 160);

    await waitFor(() => {
      expect(screen.getByText("Bookmark b0")).toBeInTheDocument();
    });
    expect(screen.getByText("Bookmark b7")).toBeInTheDocument();
    expect(screen.queryByText("Bookmark b8")).not.toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
  });

  it("navigates to the next page via the pagination controls", async () => {
    mock.addNode(folderNode("f1", "0"));
    for (let i = 0; i < 10; i++) {
      mock.addNode(bookmarkNode(`b${i}`, "f1", i));
    }
    const user = userEvent.setup();

    renderCanvas("f1");
    await resizeCanvas(320, 160);
    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Next page" }));

    expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.getByText("Bookmark b8")).toBeInTheDocument();
    expect(screen.queryByText("Bookmark b0")).not.toBeInTheDocument();
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
    await resizeCanvas(320, 160);
    // 320x160 below the 1660px tier breakpoint -> 80px icons ->
    // floor(320/80)=4 cols, floor(160/80)=2 rows -> 8 cells total.
    await waitFor(() => {
      expect(document.querySelectorAll(".grid-cell")).toHaveLength(8);
    });
  });

  it("sizes cells at the 106px tier between 1660px and 2100px", async () => {
    mock.addNode(folderNode("f1", "0"));
    mock.addNode(bookmarkNode("b0", "f1", 0));

    renderCanvas("f1");
    await resizeCanvas(1700, 106);

    await waitFor(() => {
      const cells = document.querySelectorAll(".grid-cell");
      // floor(1700/106)=16 cols, floor(106/106)=1 row -> 16 cells.
      expect(cells).toHaveLength(16);
      expect((cells[0] as HTMLElement).style.width).toBe("106px");
    });
  });

  it("sizes cells at the 166px tier at 2100px and wider", async () => {
    mock.addNode(folderNode("f1", "0"));
    mock.addNode(bookmarkNode("b0", "f1", 0));

    renderCanvas("f1");
    await resizeCanvas(2100, 166);

    await waitFor(() => {
      const cells = document.querySelectorAll(".grid-cell");
      // floor(2100/166)=12 cols, floor(166/166)=1 row -> 12 cells.
      expect(cells).toHaveLength(12);
      expect((cells[0] as HTMLElement).style.width).toBe("166px");
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
      { bookmarkId: "b0", cell: { page: 0, row: 0, col: 1 } },
      { bookmarkId: "b1", cell: { page: 0, row: 0, col: 0 } },
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
});
