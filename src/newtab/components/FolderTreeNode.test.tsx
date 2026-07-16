import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { DndTestProvider } from "../../test/DndTestProvider";
import { FolderTreeNode } from "./FolderTreeNode";

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

/**
 * Owns the shared openSettingsFolderId state the same way Sidebar does, so
 * tests exercise the real single-window-open-at-a-time coordination rather
 * than a stand-in. FolderTreeNode relies (via useSubfolders) on
 * useDndMonitor, which requires a DndContext ancestor — in the real app
 * that's provided by App.
 *
 * `depth` defaults to 1 (an editable, non-root folder). Root behavior is
 * exercised explicitly with depth 0.
 */
function Harness({
  folders,
  activeFolderId,
  onSelectFolder,
  depth = 1,
}: {
  folders: chrome.bookmarks.BookmarkTreeNode[];
  activeFolderId: string | undefined;
  onSelectFolder: (folderId: string) => void;
  depth?: number;
}) {
  const [openSettingsFolderId, setOpenSettingsFolderId] = useState<
    string | undefined
  >(undefined);

  return (
    <DndTestProvider>
      <ul>
        {folders.map((folder) => (
          <FolderTreeNode
            key={folder.id}
            folder={folder}
            activeFolderId={activeFolderId}
            onSelectFolder={onSelectFolder}
            depth={depth}
            openSettingsFolderId={openSettingsFolderId}
            onOpenSettings={setOpenSettingsFolderId}
          />
        ))}
      </ul>
    </DndTestProvider>
  );
}

function renderFolderTreeNode(props: {
  folder: chrome.bookmarks.BookmarkTreeNode;
  activeFolderId: string | undefined;
  onSelectFolder: (id: string) => void;
  depth: number;
}) {
  return render(
    <Harness
      folders={[props.folder]}
      activeFolderId={props.activeFolderId}
      onSelectFolder={props.onSelectFolder}
      depth={props.depth}
    />,
  );
}

function gearFor(title: string): HTMLElement {
  return screen
    .getByRole("button", { name: title })
    .parentElement!.querySelector(".folder-settings-toggle") as HTMLElement;
}

describe("FolderTreeNode", () => {
  it("selects the folder when its row is clicked", async () => {
    const onSelectFolder = vi.fn();
    const user = userEvent.setup();
    renderFolderTreeNode({
      folder: folderNode("f1", "1", "Work"),
      activeFolderId: undefined,
      onSelectFolder: onSelectFolder,
      depth: 1,
    });

    await user.click(screen.getByRole("button", { name: "Work" }));
    expect(onSelectFolder).toHaveBeenCalledWith("f1");
  });

  it("expands to show subfolders when the expand toggle is clicked", async () => {
    mock.addNode(folderNode("child-1", "f1", "Personal"));
    const user = userEvent.setup();
    renderFolderTreeNode({
      folder: folderNode("f1", "1", "Work"),
      activeFolderId: undefined,
      onSelectFolder: vi.fn(),
      depth: 1,
    });

    expect(screen.queryByText("Personal")).not.toBeInTheDocument();

    await user.click(
      await screen.findByRole("button", { name: "Expand folder" }),
    );

    expect(await screen.findByText("Personal")).toBeInTheDocument();
  });

  it("opens the folder settings window when the gear is clicked", async () => {
    const user = userEvent.setup();
    renderFolderTreeNode({
      folder: folderNode("f1", "1", "Work"),
      activeFolderId: undefined,
      onSelectFolder: vi.fn(),
      depth: 1,
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Folder settings" }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Folder Settings")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Work");
  });

  it("has no display-mode options in the settings window", async () => {
    const user = userEvent.setup();
    renderFolderTreeNode({
      folder: folderNode("f1", "1", "Work"),
      activeFolderId: undefined,
      onSelectFolder: vi.fn(),
      depth: 1,
    });

    await user.click(screen.getByRole("button", { name: "Folder settings" }));

    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  });

  it("toggles the window closed when the gear is clicked again", async () => {
    const user = userEvent.setup();
    renderFolderTreeNode({
      folder: folderNode("f1", "1", "Work"),
      activeFolderId: undefined,
      onSelectFolder: vi.fn(),
      depth: 1,
    });

    await user.click(screen.getByRole("button", { name: "Folder settings" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Folder settings" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes the window on Escape", async () => {
    const user = userEvent.setup();
    renderFolderTreeNode({
      folder: folderNode("f1", "1", "Work"),
      activeFolderId: undefined,
      onSelectFolder: vi.fn(),
      depth: 1,
    });

    await user.click(screen.getByRole("button", { name: "Folder settings" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("only allows one folder's settings window to be open at a time", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        folders={[
          folderNode("f1", "1", "Work"),
          folderNode("f2", "1", "Personal"),
        ]}
        activeFolderId={undefined}
        onSelectFolder={vi.fn()}
      />,
    );

    await user.click(gearFor("Work"));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByLabelText("Name")).toHaveValue("Work");

    // Switch to the other folder by closing then opening the second window,
    // since the modal backdrop covers the sidebar while one window is open.
    await user.keyboard("{Escape}");
    await user.click(gearFor("Personal"));

    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByLabelText("Name")).toHaveValue("Personal");
  });

  describe("root folders (depth 0)", () => {
    it("render no settings gear and cannot open a settings window", () => {
      renderFolderTreeNode({
        folder: folderNode("1", "0", "Bookmarks Bar"),
        activeFolderId: undefined,
        onSelectFolder: vi.fn(),
        depth: 0,
      });

      expect(
        screen.queryByRole("button", { name: "Folder settings" }),
      ).not.toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("are not draggable (no draggable attributes on the row)", () => {
      renderFolderTreeNode({
        folder: folderNode("1", "0", "Bookmarks Bar"),
        activeFolderId: undefined,
        onSelectFolder: vi.fn(),
        depth: 0,
      });

      expect(
        screen.getByRole("button", { name: "Bookmarks Bar" }),
      ).not.toHaveAttribute("aria-roledescription", "draggable");
    });

    it("still select the folder when the row is clicked", async () => {
      const onSelectFolder = vi.fn();
      const user = userEvent.setup();
      renderFolderTreeNode({
        folder: folderNode("1", "0", "Bookmarks Bar"),
        activeFolderId: undefined,
        onSelectFolder,
        depth: 0,
      });

      await user.click(screen.getByRole("button", { name: "Bookmarks Bar" }));
      expect(onSelectFolder).toHaveBeenCalledWith("1");
    });
  });

  it("a non-root row is draggable (has draggable attributes)", () => {
    renderFolderTreeNode({
      folder: folderNode("f1", "1", "Work"),
      activeFolderId: undefined,
      onSelectFolder: vi.fn(),
      depth: 1,
    });

    expect(screen.getByRole("button", { name: "Work" })).toHaveAttribute(
      "aria-roledescription",
      "draggable",
    );
  });

  it("live-updates its subfolder list on a chrome.bookmarks structure event, without any drag", async () => {
    const user = userEvent.setup();
    renderFolderTreeNode({
      folder: folderNode("f1", "1", "Work"),
      activeFolderId: undefined,
      onSelectFolder: vi.fn(),
      depth: 1,
    });

    // No expand toggle yet — f1 has no subfolders.
    expect(
      screen.queryByRole("button", { name: "Expand folder" }),
    ).not.toBeInTheDocument();

    // Simulates a folder created via Chrome's native bookmark manager
    // (or another open new-tab page), not a drag within this component.
    const child = folderNode("child-1", "f1", "Personal");
    mock.addNode(child);
    mock.chrome.bookmarks.onCreated.emit("child-1", child);

    await user.click(
      await screen.findByRole("button", { name: "Expand folder" }),
    );
    expect(await screen.findByText("Personal")).toBeInTheDocument();
  });
});
