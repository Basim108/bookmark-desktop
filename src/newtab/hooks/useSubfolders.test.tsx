import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { useSubfolders } from "./useSubfolders";

const mock = installChromeMock();

beforeEach(() => {
  mock.reset();
});

function folderNode(
  id: string,
  parentId: string,
  title: string,
): chrome.bookmarks.BookmarkTreeNode {
  return { id, parentId, index: 0, title, syncing: false };
}

function Subfolders({ folderId }: { folderId: string }) {
  const { folders, loading } = useSubfolders(folderId);
  if (loading) {
    return <p>loading</p>;
  }
  return (
    <ul>
      {folders.map((folder) => (
        <li key={folder.id}>{folder.title}</li>
      ))}
    </ul>
  );
}

describe("useSubfolders", () => {
  /**
   * The sidebar's folder list has exactly one writer: the refetch driven by
   * real chrome.bookmarks events. Nothing about a drag in progress may change
   * it, so the hook must not observe drag state at all — rendering it with no
   * DndContext ancestor is the sharpest available proof of that. When the hook
   * predicted drops locally (via useDndMonitor) this threw, and that prediction
   * was what removed a folder's row for a drop that never moved anything.
   */
  it("works with no DndContext ancestor — the list never depends on drag state", async () => {
    mock.addNode(folderNode("child-1", "f1", "Personal"));

    render(<Subfolders folderId="f1" />);

    expect(await screen.findByText("Personal")).toBeInTheDocument();
  });

  it("live-syncs on a bookmark event with no DndContext ancestor", async () => {
    render(<Subfolders folderId="f1" />);
    // Settles to an empty list first — f1 has no subfolders yet.
    expect(await screen.findByRole("list")).toBeEmptyDOMElement();

    const child = folderNode("child-1", "f1", "Personal");
    mock.addNode(child);
    mock.chrome.bookmarks.onCreated.emit("child-1", child);

    expect(await screen.findByText("Personal")).toBeInTheDocument();
  });
});
