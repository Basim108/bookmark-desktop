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

  describe("announcing an update", () => {
    function seedRoot() {
      mock.addNode(folderNode("1", "0", "Bookmarks Bar"));
    }

    /** Puts a notice in the state the service worker would have left on update. */
    async function seedPendingNotice() {
      mock.setManifestVersion("1.1.0");
      await chrome.storage.local.set({
        releaseNotice: { pending: { from: "1.0.0", to: "1.1.0" } },
      });
    }

    it("opens the what's-new window when an update left one pending", async () => {
      seedRoot();
      await seedPendingNotice();

      render(<App />);

      expect(
        await screen.findByRole("dialog", { name: "What's new" }),
      ).toBeVisible();
    });

    it("opens no window when there is nothing to announce", async () => {
      seedRoot();

      render(<App />);
      await waitFor(() => {
        expect(document.querySelector('[data-folder-id="1"]')).toBeTruthy();
      });

      expect(
        screen.queryByRole("dialog", { name: "What's new" }),
      ).not.toBeInTheDocument();
    });

    /**
     * A new tab is very often opened in order to be left immediately. Waiting
     * for restoration means the window never renders for those visits, so it is
     * not spent on a user who was never going to read it.
     */
    it("waits for the page to finish restoring before opening", async () => {
      seedRoot();
      await seedPendingNotice();
      let releaseRestore: (value: unknown) => void = () => {};
      const restored = new Promise((resolve) => {
        releaseRestore = resolve;
      });
      const realGet = chrome.storage.local.get;
      chrome.storage.local.get = (async (keys?: unknown) => {
        if (keys === "lastFolderId") await restored;
        return (realGet as (k?: unknown) => Promise<unknown>)(keys);
      }) as typeof chrome.storage.local.get;

      render(<App />);
      await screen.findByText("Bookmarks Bar");

      expect(
        screen.queryByRole("dialog", { name: "What's new" }),
      ).not.toBeInTheDocument();

      releaseRestore(undefined);
      expect(
        await screen.findByRole("dialog", { name: "What's new" }),
      ).toBeVisible();
      chrome.storage.local.get = realGet;
    });

    it("does not reopen after the user dismisses it", async () => {
      seedRoot();
      await seedPendingNotice();
      const user = userEvent.setup();

      const { unmount } = render(<App />);
      await user.click(
        await screen.findByRole("button", { name: "Close What's new" }),
      );
      unmount();

      render(<App />);
      await waitFor(() => {
        expect(document.querySelector('[data-folder-id="1"]')).toBeTruthy();
      });
      expect(
        screen.queryByRole("dialog", { name: "What's new" }),
      ).not.toBeInTheDocument();
    });

    it("leaves the notice pending when the page is left without dismissing it", async () => {
      seedRoot();
      await seedPendingNotice();

      const { unmount } = render(<App />);
      await screen.findByRole("dialog", { name: "What's new" });
      unmount();

      render(<App />);
      expect(
        await screen.findByRole("dialog", { name: "What's new" }),
      ).toBeVisible();
    });
  });
});
