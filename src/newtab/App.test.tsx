import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../test/chromeMock";
import { App } from "./App";

const mock = installChromeMock();

function folderNode(
  id: string,
  parentId: string,
  title: string,
): chrome.bookmarks.BookmarkTreeNode {
  return { id, parentId, index: 0, title, syncing: false };
}

beforeEach(() => {
  mock.reset();
});

describe("App", () => {
  it("selects the first root folder by default and renders its canvas", async () => {
    mock.addNode(folderNode("1", "0", "Bookmarks Bar"));
    mock.addNode(folderNode("2", "0", "Other Bookmarks"));

    render(<App />);

    expect(await screen.findByText("Bookmarks Bar")).toBeInTheDocument();
    await waitFor(() => {
      expect(document.querySelector('[data-folder-id="1"]')).toBeTruthy();
    });
  });

  it("switches the selected folder when a different sidebar folder is clicked", async () => {
    mock.addNode(folderNode("1", "0", "Bookmarks Bar"));
    mock.addNode(folderNode("2", "0", "Other Bookmarks"));
    const user = userEvent.setup();

    render(<App />);
    await waitFor(() => {
      expect(document.querySelector('[data-folder-id="1"]')).toBeTruthy();
    });

    const otherFolderButton = await screen.findByRole("button", {
      name: "Other Bookmarks",
    });
    await user.click(otherFolderButton);

    await waitFor(() => {
      expect(document.querySelector('[data-folder-id="2"]')).toBeTruthy();
    });
  });
});
