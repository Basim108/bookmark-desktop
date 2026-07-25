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

  describe("restoring the last opened folder", () => {
    /** Bookmarks Bar + Other Bookmarks, with Work nested under Bookmarks Bar. */
    function seedTree() {
      mock.addNode(folderNode("1", "0", "Bookmarks Bar"));
      mock.addNode(folderNode("2", "0", "Other Bookmarks"));
      mock.addNode(folderNode("work", "1", "Work"));
    }

    async function storedLastFolderId(): Promise<unknown> {
      return (await chrome.storage.local.get("lastFolderId")).lastFolderId;
    }

    it("opens on the stored folder rather than the first root folder", async () => {
      seedTree();
      await chrome.storage.local.set({ lastFolderId: "2" });

      render(<App />);

      await waitFor(() => {
        expect(document.querySelector('[data-folder-id="2"]')).toBeTruthy();
      });
      expect(document.querySelector('[data-folder-id="1"]')).toBeFalsy();
    });

    it("falls back to the first root folder when nothing is stored", async () => {
      seedTree();

      render(<App />);

      await waitFor(() => {
        expect(document.querySelector('[data-folder-id="1"]')).toBeTruthy();
      });
    });

    it("falls back when the stored folder no longer exists", async () => {
      seedTree();
      await chrome.storage.local.set({ lastFolderId: "deleted-folder" });

      render(<App />);

      await waitFor(() => {
        expect(document.querySelector('[data-folder-id="1"]')).toBeTruthy();
      });
    });

    it("does not overwrite the stored id with the fallback", async () => {
      // Opening a tab on a profile where ids were reassigned must not erase
      // the recorded folder — otherwise it could never be recovered.
      seedTree();
      await chrome.storage.local.set({ lastFolderId: "deleted-folder" });

      render(<App />);

      await waitFor(() => {
        expect(document.querySelector('[data-folder-id="1"]')).toBeTruthy();
      });
      expect(await storedLastFolderId()).toBe("deleted-folder");
    });

    it("does not re-record the folder it just restored", async () => {
      seedTree();
      await chrome.storage.local.set({ lastFolderId: "2" });
      mock.chrome.storage.local.set.mockClear();

      render(<App />);

      await waitFor(() => {
        expect(document.querySelector('[data-folder-id="2"]')).toBeTruthy();
      });
      const wroteLastFolderId = mock.chrome.storage.local.set.mock.calls.some(
        ([items]) =>
          typeof items === "object" &&
          items !== null &&
          "lastFolderId" in items,
      );
      expect(wroteLastFolderId).toBe(false);
    });

    it("renders no canvas at all until restoration resolves", async () => {
      seedTree();
      await chrome.storage.local.set({ lastFolderId: "2" });

      render(<App />);

      // The first root folder's canvas must never appear, not even for one
      // frame before the restored folder replaces it.
      expect(document.querySelector("[data-folder-id]")).toBeFalsy();

      await waitFor(() => {
        expect(document.querySelector('[data-folder-id="2"]')).toBeTruthy();
      });
    });

    it("records the folder the user selects", async () => {
      seedTree();
      const user = userEvent.setup();

      render(<App />);
      await waitFor(() => {
        expect(document.querySelector('[data-folder-id="1"]')).toBeTruthy();
      });

      await user.click(
        await screen.findByRole("button", { name: "Other Bookmarks" }),
      );

      await waitFor(async () => {
        expect(await storedLastFolderId()).toBe("2");
      });
    });

    it("expands the restored folder's ancestors so its row is visible", async () => {
      seedTree();
      await chrome.storage.local.set({ lastFolderId: "work" });

      render(<App />);

      // "Work" is nested under Bookmarks Bar, which starts collapsed — it is
      // only reachable if the restore expanded its ancestor.
      const workRow = await screen.findByRole("button", { name: "Work" });
      expect(workRow).toBeInTheDocument();
      expect(workRow.closest(".folder-row")).toHaveClass("folder-row--active");
    });

    it("leaves the restored folder's own children collapsed", async () => {
      seedTree();
      mock.addNode(folderNode("rust", "work", "Rust"));
      await chrome.storage.local.set({ lastFolderId: "work" });

      render(<App />);

      await screen.findByRole("button", { name: "Work" });
      expect(screen.queryByText("Rust")).not.toBeInTheDocument();
    });

    it("expands nothing when the restored folder is a root folder", async () => {
      seedTree();
      await chrome.storage.local.set({ lastFolderId: "2" });

      render(<App />);

      await waitFor(() => {
        expect(document.querySelector('[data-folder-id="2"]')).toBeTruthy();
      });
      expect(screen.queryByText("Work")).not.toBeInTheDocument();
    });

    it("keeps a seeded ancestor collapsed after the user collapses it", async () => {
      seedTree();
      await chrome.storage.local.set({ lastFolderId: "work" });
      const user = userEvent.setup();

      render(<App />);
      await screen.findByRole("button", { name: "Work" });

      await user.click(
        await screen.findByRole("button", { name: "Collapse folder" }),
      );

      expect(screen.queryByText("Work")).not.toBeInTheDocument();
    });
  });
});
