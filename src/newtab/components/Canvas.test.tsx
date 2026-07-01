import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { installResizeObserverMock } from "../../test/resizeObserverMock";
import { Canvas } from "./Canvas";

const mock = installChromeMock();
const resizeMock = installResizeObserverMock();

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
    // 10 bookmarks; default global settings (max 96, min 48) at 200x100
    // gives capacity 4x2 = 8 per page -> 2 pages (8 + 2).
    mock.addNode(folderNode("f1", "0"));
    for (let i = 0; i < 10; i++) {
      mock.addNode(bookmarkNode(`b${i}`, "f1", i));
    }

    render(<Canvas folderId="f1" />);
    await resizeCanvas(200, 100);

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

    render(<Canvas folderId="f1" />);
    await resizeCanvas(200, 100);
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

    render(<Canvas folderId="f1" />);
    await resizeCanvas(200, 100);

    const icon = await screen.findByText("Bookmark b0");
    await user.click(icon);

    expect(assign).toHaveBeenCalledWith("https://example.com/b0");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("does not paginate when everything fits on one page", async () => {
    mock.addNode(folderNode("f1", "0"));
    mock.addNode(bookmarkNode("b0", "f1", 0));
    mock.addNode(bookmarkNode("b1", "f1", 1));

    render(<Canvas folderId="f1" />);
    await resizeCanvas(200, 100);

    await waitFor(() => {
      expect(screen.getByText("Bookmark b0")).toBeInTheDocument();
    });
    expect(screen.queryByLabelText("Canvas pages")).not.toBeInTheDocument();
  });
});
