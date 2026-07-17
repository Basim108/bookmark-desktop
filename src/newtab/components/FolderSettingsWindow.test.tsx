import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { getBookmarksInFolder, getSubfolders } from "../../lib/bookmarks/read";
import {
  DEFAULT_FOLDER_SETTINGS,
  getFolderSettings,
  setFolderHasCustomIcon,
} from "../../lib/storage/folderSettings";
import { DEFAULT_FOLDER_ICON_KEY } from "../../lib/storage/defaultFolderIcon";
import { deleteIcon, getIcon, putIcon } from "../../lib/storage/iconDb";
import type { FolderSettings } from "../../lib/storage/schema";
import { FolderSettingsWindow } from "./FolderSettingsWindow";

const mock = installChromeMock();

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function stubImageBitmap() {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 32, height: 32, close: () => {} })),
  );
}

function pngFile(name = "icon.png"): File {
  return new File([new Uint8Array(PNG_HEADER)], name, { type: "image/png" });
}

function folderNode(
  id: string,
  title = `Folder ${id}`,
): chrome.bookmarks.BookmarkTreeNode {
  return { id, parentId: "1", index: 0, title, syncing: false };
}

function renderWindow(options?: {
  folder?: chrome.bookmarks.BookmarkTreeNode;
  settings?: FolderSettings;
}) {
  const folder = options?.folder ?? folderNode("f1");
  const onClose = vi.fn();
  const onSaved = vi.fn();
  mock.addNode(folder);
  render(
    <FolderSettingsWindow
      folder={folder}
      settings={options?.settings ?? DEFAULT_FOLDER_SETTINGS}
      iconVersion={0}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { folder, onClose, onSaved };
}

beforeEach(async () => {
  mock.reset();
  vi.clearAllMocks();
  await deleteIcon(DEFAULT_FOLDER_ICON_KEY);
});

describe("FolderSettingsWindow", () => {
  it("pre-fills the name and offers no display-mode options", () => {
    renderWindow({ folder: folderNode("f1", "Work") });

    expect(screen.getByLabelText("Name")).toHaveValue("Work");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("previews the shared default folder icon when no custom image is staged", async () => {
    await putIcon(
      DEFAULT_FOLDER_ICON_KEY,
      new Blob(["default"], { type: "image/png" }),
    );
    renderWindow({ folder: folderNode("f1", "Work") });

    await waitFor(() => {
      const preview = screen.getByRole("img", { name: "Work" });
      expect(preview.getAttribute("src")).toMatch(/^blob:/);
    });
  });

  it("stages a name edit and applies it only on Save", async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = renderWindow({
      folder: folderNode("f1", "Work"),
    });

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Renamed");

    // Nothing persisted before Save.
    expect(mock.chrome.bookmarks.update).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mock.chrome.bookmarks.update).toHaveBeenCalledWith("f1", {
      title: "Renamed",
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("discards edits when closed via the close button without saving", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Should not persist");
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
    expect(mock.chrome.bookmarks.update).not.toHaveBeenCalled();
  });

  it("closes on Escape without persisting", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
    expect(mock.chrome.bookmarks.update).not.toHaveBeenCalled();
  });

  it("disables Save for an empty or whitespace-only name", async () => {
    const user = userEvent.setup();
    renderWindow();

    await user.clear(screen.getByLabelText("Name"));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.type(screen.getByLabelText("Name"), "   ");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Valid");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("previews a staged image and persists it only on Save", async () => {
    stubImageBitmap();
    const user = userEvent.setup();
    const { onClose } = renderWindow({ folder: folderNode("f2", "Uploads") });

    await user.upload(screen.getByLabelText("Upload image"), pngFile());

    await waitFor(() => {
      const preview = screen.getByRole("img", { name: "Uploads" });
      expect(preview.getAttribute("src")).toMatch(/^blob:/);
    });
    // Nothing written to storage yet.
    expect(await getIcon("f2")).toBeUndefined();
    expect((await getFolderSettings("f2")).hasCustomIcon).toBe(false);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await getIcon("f2")).toBeDefined();
    expect((await getFolderSettings("f2")).hasCustomIcon).toBe(true);
  });

  it("stages an image removal and clears the custom icon on Save", async () => {
    const user = userEvent.setup();
    await putIcon("f3", new Blob(["bytes"], { type: "image/png" }));
    // Seed storage consistently with the prop (icon present).
    await setFolderHasCustomIcon("f3", true);
    const { onClose } = renderWindow({
      folder: folderNode("f3", "Photos"),
      settings: { hasCustomIcon: true },
    });

    await user.click(screen.getByRole("button", { name: "Remove image" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await getIcon("f3")).toBeUndefined();
    expect((await getFolderSettings("f3")).hasCustomIcon).toBe(false);
  });

  it("requires confirmation before removing, then deletes the subtree and closes", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow();

    await user.click(screen.getByRole("button", { name: "Remove folder" }));
    expect(mock.chrome.bookmarks.removeTree).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Confirm remove" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm remove" }));
    expect(mock.chrome.bookmarks.removeTree).toHaveBeenCalledWith("f1");
    expect(mock.chrome.bookmarks.remove).not.toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

function jsonFile(value: unknown, name = "utab.json"): File {
  return new File([JSON.stringify(value)], name, {
    type: "application/json",
  });
}

describe("FolderSettingsWindow — import", () => {
  it("offers an Import Bookmarks dropdown with an Import uTab item", async () => {
    const user = userEvent.setup();
    renderWindow();

    // Menu closed initially.
    expect(
      screen.queryByRole("menuitem", { name: "Import uTab" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Import Bookmarks/ }));
    expect(
      screen.getByRole("menuitem", { name: "Import uTab" }),
    ).toBeInTheDocument();
  });

  it("imports a chosen uTab file into this folder and shows a summary", async () => {
    stubImageBitmap();
    const user = userEvent.setup();
    const { onSaved } = renderWindow({ folder: folderNode("f9", "Target") });

    const file = jsonFile({
      folders: [
        {
          name: "Work",
          bookmarks: [
            { title: "Alpha", url: "https://alpha.example" },
            { title: "Beta", url: "https://beta.example" },
          ],
        },
      ],
    });

    await user.upload(screen.getByLabelText("Import bookmarks file"), file);

    await screen.findByText("Imported 1 folder, 2 bookmarks.");

    const subfolders = await getSubfolders("f9");
    expect(subfolders.map((f) => f.title)).toEqual(["Work"]);
    const bookmarks = await getBookmarksInFolder(subfolders[0]!.id);
    expect(bookmarks.map((b) => b.title)).toEqual(["Alpha", "Beta"]);
    expect(onSaved).toHaveBeenCalled();
  });

  it("shows an error and creates nothing for a file that isn't valid JSON", async () => {
    const user = userEvent.setup();
    renderWindow({ folder: folderNode("f10", "Target") });

    const file = new File(["{ not json"], "bad.json", {
      type: "application/json",
    });

    await user.upload(screen.getByLabelText("Import bookmarks file"), file);

    await screen.findByText("That file isn’t valid JSON.");
    expect(await getSubfolders("f10")).toEqual([]);
  });
});
