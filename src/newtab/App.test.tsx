import { render, screen } from "@testing-library/react";
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
  it("selects the first root folder by default and shows it in the canvas", async () => {
    mock.addNode(folderNode("1", "0", "Bookmarks Bar"));
    mock.addNode(folderNode("2", "0", "Other Bookmarks"));

    render(<App />);

    expect(await screen.findByText("Bookmarks Bar")).toBeInTheDocument();
    expect(await screen.findByText(/Selected folder: 1/)).toBeInTheDocument();
  });

  it("switches the selected folder when a different sidebar folder is clicked", async () => {
    mock.addNode(folderNode("1", "0", "Bookmarks Bar"));
    mock.addNode(folderNode("2", "0", "Other Bookmarks"));
    const user = userEvent.setup();

    render(<App />);

    const otherFolderButton = await screen.findByRole("button", {
      name: "Other Bookmarks",
    });
    await user.click(otherFolderButton);

    expect(await screen.findByText(/Selected folder: 2/)).toBeInTheDocument();
  });
});
