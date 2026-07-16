import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import {
  DEFAULT_BOOKMARK_SETTINGS,
  getBookmarkSettings,
} from "../../lib/storage/bookmarkSettings";
import { getIcon, putIcon } from "../../lib/storage/iconDb";
import type { BookmarkSettings } from "../../lib/storage/schema";
import { EditBookmarkWindow } from "./EditBookmarkWindow";

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

function node(
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

function renderWindow(options?: {
  bookmark?: chrome.bookmarks.BookmarkTreeNode;
  settings?: BookmarkSettings;
}) {
  const bookmark = options?.bookmark ?? node("b1");
  const onClose = vi.fn();
  const onSaved = vi.fn();
  mock.addNode(bookmark);
  render(
    <EditBookmarkWindow
      bookmark={bookmark}
      settings={options?.settings ?? DEFAULT_BOOKMARK_SETTINGS}
      iconVersion={0}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { bookmark, onClose, onSaved };
}

beforeEach(() => {
  mock.reset();
  // Clears vi.fn call history (e.g. chrome.bookmarks.update) between tests
  // without discarding the mock implementations installed at module load.
  vi.clearAllMocks();
});

describe("EditBookmarkWindow", () => {
  it("pre-fills the name and url from the bookmark", () => {
    renderWindow({ bookmark: node("b1", "https://example.com/page") });

    expect(screen.getByLabelText("Name")).toHaveValue("Bookmark b1");
    expect(screen.getByLabelText("URL")).toHaveValue(
      "https://example.com/page",
    );
  });

  it("stages name, url, and label edits and applies them only on Save", async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = renderWindow();

    await user.clear(screen.getByLabelText("Name"));
    await user.type(screen.getByLabelText("Name"), "Renamed");
    await user.clear(screen.getByLabelText("URL"));
    await user.type(screen.getByLabelText("URL"), "https://new.test/");
    await user.click(screen.getByRole("checkbox")); // under-icon -> tooltip

    // Nothing persisted before Save.
    expect(mock.chrome.bookmarks.update).not.toHaveBeenCalled();
    expect((await getBookmarkSettings("b1")).labelDisplay).toBe("under-icon");

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mock.chrome.bookmarks.update).toHaveBeenCalledWith("b1", {
      title: "Renamed",
      url: "https://new.test/",
    });
    expect((await getBookmarkSettings("b1")).labelDisplay).toBe("tooltip");
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

  it("disables Save for an empty name or an unsafe url", async () => {
    const user = userEvent.setup();
    renderWindow();

    await user.clear(screen.getByLabelText("Name"));
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.type(screen.getByLabelText("Name"), "Valid");
    await user.clear(screen.getByLabelText("URL"));
    await user.type(screen.getByLabelText("URL"), "javascript:alert(1)");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(/valid url/i);
  });

  it("previews a staged image without persisting it until Save", async () => {
    stubImageBitmap();
    const user = userEvent.setup();
    const { onClose } = renderWindow({ bookmark: node("img1") });

    await user.upload(screen.getByLabelText("Upload image"), pngFile());

    await waitFor(() => {
      const preview = screen.getByRole("img", { name: "Bookmark img1" });
      expect(preview.getAttribute("src")).toMatch(/^blob:/);
    });
    // Staged only — nothing written to storage yet.
    expect(await getIcon("img1")).toBeUndefined();
    expect((await getBookmarkSettings("img1")).hasCustomIcon).toBe(false);

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await getIcon("img1")).toBeDefined();
    expect((await getBookmarkSettings("img1")).hasCustomIcon).toBe(true);
  });

  it("shows Remove image only when the bookmark has a custom icon", async () => {
    const { rerender } = render(
      <EditBookmarkWindow
        bookmark={node("b1")}
        settings={DEFAULT_BOOKMARK_SETTINGS}
        iconVersion={0}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Remove image" }),
    ).not.toBeInTheDocument();

    rerender(
      <EditBookmarkWindow
        bookmark={node("b1")}
        settings={{ labelDisplay: "under-icon", hasCustomIcon: true }}
        iconVersion={0}
        onSaved={vi.fn()}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Remove image" }),
    ).toBeInTheDocument();
  });

  it("stages a custom-icon removal and reverts to favicon on Save", async () => {
    const user = userEvent.setup();
    await putIcon("img2", new Blob(["bytes"], { type: "image/png" }));
    const { onClose } = renderWindow({
      bookmark: node("img2"),
      settings: { labelDisplay: "under-icon", hasCustomIcon: true },
    });

    await user.click(screen.getByRole("button", { name: "Remove image" }));
    // Not persisted until Save.
    expect(await getIcon("img2")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await getIcon("img2")).toBeUndefined();
    expect((await getBookmarkSettings("img2")).hasCustomIcon).toBe(false);
  });

  it("requires confirmation before removing, then deletes and closes", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow();

    await user.click(screen.getByRole("button", { name: "Remove" }));
    expect(mock.chrome.bookmarks.remove).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Confirm remove" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirm remove" }));
    expect(mock.chrome.bookmarks.remove).toHaveBeenCalledWith("b1");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
