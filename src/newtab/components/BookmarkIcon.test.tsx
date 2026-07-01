import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { DndTestProvider } from "../../test/DndTestProvider";
import { setBookmarkHasCustomIcon } from "../../lib/storage/bookmarkSettings";
import { putIcon } from "../../lib/storage/iconDb";
import { BookmarkIcon } from "./BookmarkIcon";

const mock = installChromeMock();

function bookmarkNode(
  id: string,
  url = "https://example.com",
): chrome.bookmarks.BookmarkTreeNode {
  return {
    id,
    parentId: "1",
    index: 0,
    title: `Bookmark ${id}`,
    url,
    syncing: false,
  };
}

function renderIcon(bookmark: chrome.bookmarks.BookmarkTreeNode) {
  return render(
    <DndTestProvider>
      <BookmarkIcon bookmark={bookmark} size={64} folderId="1" />
    </DndTestProvider>,
  );
}

beforeEach(() => {
  mock.reset();
});

describe("BookmarkIcon", () => {
  it("renders the favicon by default", async () => {
    renderIcon(bookmarkNode("b1"));
    const img = await screen.findByRole("img", { name: "Bookmark b1" });
    expect(img.getAttribute("src")).toContain("_favicon");
  });

  it("falls back to a generic icon when the favicon fails to load", async () => {
    renderIcon(bookmarkNode("b1"));
    const img = await screen.findByRole("img", { name: "Bookmark b1" });
    fireEvent.error(img);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(document.querySelector(".favicon-fallback")).toBeInTheDocument();
  });

  it("renders the custom icon instead of the favicon once hasCustomIcon is set", async () => {
    await setBookmarkHasCustomIcon("b1", true);
    await putIcon("b1", new Blob(["bytes"], { type: "image/png" }));

    renderIcon(bookmarkNode("b1"));

    await waitFor(() => {
      const img = screen.getByRole("img", { name: "Bookmark b1" });
      expect(img.getAttribute("src")).toMatch(/^blob:/);
    });
  });

  it("shows the label under the icon by default, and only as a tooltip once set to tooltip-only", async () => {
    const user = userEvent.setup();
    renderIcon(bookmarkNode("b1"));

    expect(screen.getByText("Bookmark b1")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Bookmark b1 icon settings" }),
    );
    await user.click(screen.getByRole("radio", { name: "Tooltip only" }));

    await waitFor(() =>
      expect(screen.queryByText("Bookmark b1")).not.toBeInTheDocument(),
    );
    expect(screen.getByTitle("Bookmark b1")).toBeInTheDocument();
  });
});
