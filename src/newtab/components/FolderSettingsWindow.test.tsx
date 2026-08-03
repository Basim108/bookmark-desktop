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

function renderCreateWindow(parentId = "parent1") {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  // Give the parent a real node so getSubfolders(parentId) can enumerate the
  // child the draft creates.
  mock.addNode(folderNode(parentId, "Parent"));
  render(
    <FolderSettingsWindow
      createParentId={parentId}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onClose, onSaved };
}

describe("FolderSettingsWindow — new folder (draft) mode", () => {
  it("titles for a new folder, starts empty, and hides removal and import", () => {
    renderCreateWindow();

    expect(screen.getByText("New Folder")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: "Remove folder" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Import Bookmarks/ }),
    ).not.toBeInTheDocument();
  });

  it("creates the folder as a first child (index 0) only on Save", async () => {
    const user = userEvent.setup();
    const { onClose, onSaved } = renderCreateWindow("parent1");

    await user.type(screen.getByLabelText("Name"), "New");
    // Nothing created before Save.
    expect(mock.chrome.bookmarks.create).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mock.chrome.bookmarks.create).toHaveBeenCalledWith({
      parentId: "parent1",
      title: "New",
      index: 0,
    });
    expect(onSaved).toHaveBeenCalled();
    const subfolders = await getSubfolders("parent1");
    expect(subfolders.map((f) => f.title)).toContain("New");
  });

  it("applies a staged icon to the created folder on Save", async () => {
    stubImageBitmap();
    const user = userEvent.setup();
    const { onClose } = renderCreateWindow("parent2");

    await user.type(screen.getByLabelText("Name"), "Iconed");
    await user.upload(screen.getByLabelText("Upload image"), pngFile());
    await waitFor(() => {
      const preview = screen.getByRole("img", { name: "New folder" });
      expect(preview.getAttribute("src")).toMatch(/^blob:/);
    });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const created = (await getSubfolders("parent2")).find(
      (f) => f.title === "Iconed",
    )!;
    expect(await getIcon(created.id)).toBeDefined();
    expect((await getFolderSettings(created.id)).hasCustomIcon).toBe(true);
  });

  it("writes nothing when closed via Escape without saving", async () => {
    const user = userEvent.setup();
    const { onClose } = renderCreateWindow("parent3");

    await user.type(screen.getByLabelText("Name"), "Discarded");
    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
    expect(mock.chrome.bookmarks.create).not.toHaveBeenCalled();
    expect(await getSubfolders("parent3")).toEqual([]);
  });
});

/**
 * Records downloads triggered by the object-URL anchor in transfer/download.ts.
 * jsdom implements neither createObjectURL nor anchor-driven navigation, so
 * both are stubbed and the anchor's `download` attribute is what we assert on.
 */
function captureDownloads() {
  const names: string[] = [];
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:stub");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    names.push(this.download);
  });
  return { files: () => names };
}

function jsonFile(value: unknown, name = "utab.json"): File {
  return new File([JSON.stringify(value)], name, {
    type: "application/json",
  });
}

/**
 * Drives the import exactly as a user must: open the menu, activate Import
 * uTab — which is what records the destination and opens the picker — then
 * supply the file. Uploading straight to the input skips the step that tells
 * the flow which folder it is importing into.
 */
async function chooseImportFile(
  user: ReturnType<typeof userEvent.setup>,
  file: File,
) {
  await user.click(screen.getByRole("button", { name: /Import Bookmarks/ }));
  await user.click(screen.getByRole("menuitem", { name: "Import uTab" }));
  await user.upload(screen.getByLabelText("Import bookmarks file"), file);
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
    renderWindow({ folder: folderNode("f9", "Target") });

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

    await chooseImportFile(user, file);

    await screen.findByText("Imported 1 folder, 2 bookmarks.");

    const subfolders = await getSubfolders("f9");
    expect(subfolders.map((f) => f.title)).toEqual(["Work"]);
    const bookmarks = await getBookmarksInFolder(subfolders[0]!.id);
    expect(bookmarks.map((b) => b.title)).toEqual(["Alpha", "Beta"]);
  });

  it("shows an error and creates nothing for a file that isn't valid JSON", async () => {
    const user = userEvent.setup();
    renderWindow({ folder: folderNode("f10", "Target") });

    const file = new File(["{ not json"], "bad.json", {
      type: "application/json",
    });

    await chooseImportFile(user, file);

    await screen.findByText("That file isn’t valid JSON.");
    expect(await getSubfolders("f10")).toEqual([]);
  });
});

describe("FolderSettingsWindow — import report", () => {
  it("downloads a .log report and names it in the summary when entries are skipped", async () => {
    const user = userEvent.setup();
    const downloads = captureDownloads();
    renderWindow({ folder: folderNode("f11", "Target") });

    const file = jsonFile(
      {
        folders: [
          {
            name: "Work",
            bookmarks: [
              { title: "Danger", url: "javascript:alert(1)" },
              { title: "Keep", url: "https://keep.example" },
            ],
          },
        ],
      },
      "my-utab-export.json",
    );

    await chooseImportFile(user, file);

    await screen.findByText(/my-utab-export-report\.log/);
    expect(downloads.files()).toEqual(["my-utab-export-report.log"]);
  });

  it("does not download a report for a clean import", async () => {
    const user = userEvent.setup();
    const downloads = captureDownloads();
    renderWindow({ folder: folderNode("f12", "Target") });

    const file = jsonFile({
      folders: [
        {
          name: "Work",
          bookmarks: [{ title: "Keep", url: "https://k.example" }],
        },
      ],
    });

    await chooseImportFile(user, file);

    await screen.findByText("Imported 1 folder, 1 bookmark.");
    expect(downloads.files()).toEqual([]);
  });

  it("clears the busy state and reports the failure when the importer throws", async () => {
    const user = userEvent.setup();
    const downloads = captureDownloads();
    renderWindow({ folder: folderNode("f13", "Target") });
    // Reject every create so the import cannot even make its first folder.
    mock.chrome.bookmarks.create.mockRejectedValue(
      new Error("QUOTA_BYTES quota exceeded"),
    );

    const file = jsonFile(
      {
        folders: [
          {
            name: "Work",
            bookmarks: [{ title: "A", url: "https://a.example" }],
          },
        ],
      },
      "boom.json",
    );

    await chooseImportFile(user, file);

    // The pre-fix behaviour was an unhandled rejection that left this button
    // disabled forever, with no message ever rendered.
    await screen.findByText(/boom-report\.log/);
    expect(downloads.files()).toEqual(["boom-report.log"]);
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Import Bookmarks/ }),
      ).toBeEnabled();
    });
  });
});

/**
 * A file whose `text()` stays pending until released.
 *
 * The flow sets its running state *before* awaiting `file.text()`, so holding
 * that promise parks the import in "running" for as long as a test needs.
 * Without this the assertions race a jsdom import that finishes in under a
 * millisecond — and a dismissal guard that is never observed while running is
 * a guard that was never actually tested.
 */
function heldImportFile(value: unknown, name = "utab.json") {
  const text = JSON.stringify(value);
  const file = new File([text], name, { type: "application/json" });
  let release!: () => void;
  const pending = new Promise<string>((resolve) => {
    release = () => resolve(text);
  });
  file.text = () => pending;
  return { file, release };
}

/** A modest export; 1 folder + 25 bookmarks = 26 attempted entries. */
function bulkExport(name = "utab.json") {
  return {
    value: {
      folders: [
        {
          name: "Work",
          bookmarks: Array.from({ length: 25 }, (_, i) => ({
            title: `B${i}`,
            url: `https://example.com/${i}`,
          })),
        },
      ],
    },
    name,
  };
}

describe("FolderSettingsWindow — import progress", () => {
  it("reports progress inside the window, with a spinner and a live count", async () => {
    // Pace bookmark creation so intermediate counts are actually observable;
    // without it the whole import lands in one batch. Capture the *implementation*,
    // not the mock — calling the mock from inside its own replacement recurses.
    const create = mock.chrome.bookmarks.create;
    const original = create.getMockImplementation()!;
    create.mockImplementation(async (...args: Parameters<typeof original>) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return original(...args);
    });

    const user = userEvent.setup();
    renderWindow({ folder: folderNode("fp1", "Target") });
    const { value, name } = bulkExport();

    await chooseImportFile(user, jsonFile(value, name));

    // The window is portalled to document.body, so queries go through document
    // rather than render()'s container.
    await waitFor(() =>
      expect(
        document.querySelector(".folder-settings-window-import-progress"),
      ).toHaveTextContent(/Importing… \d+ \/ 26/),
    );
    expect(document.querySelector(".spinner")).not.toBeNull();
  });

  it("stays open when the import finishes and shows the report filename", async () => {
    const user = userEvent.setup();
    const downloads = captureDownloads();
    const { onClose } = renderWindow({ folder: folderNode("fp2", "Target") });

    await chooseImportFile(
      user,
      jsonFile(
        {
          folders: [
            {
              name: "Work",
              bookmarks: [
                { title: "Keep", url: "https://keep.example" },
                { title: "Bad", url: "not-a-url" },
              ],
            },
          ],
        },
        "uTab_settings.json",
      ),
    );

    await screen.findByText(/Details in uTab_settings-report\.log\./);
    // The import closes the window neither at its start nor at its end.
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(downloads.files()).toEqual(["uTab_settings-report.log"]);
  });
});

describe("FolderSettingsWindow — dismissal while importing", () => {
  /** Starts an import and parks it mid-flight. */
  async function startHeldImport(folderId: string) {
    const user = userEvent.setup();
    const rendered = renderWindow({ folder: folderNode(folderId, "Target") });
    const { value, name } = bulkExport();
    const { file, release } = heldImportFile(value, name);
    await chooseImportFile(user, file);
    await waitFor(() =>
      expect(
        document.querySelector(".folder-settings-window-import-progress"),
      ).toBeInTheDocument(),
    );
    return { user, release, ...rendered };
  }

  /*
   * Three routes, three tests. A single combined assertion would pass with two
   * of the three still able to dismiss the window — which is how
   * pre-publication finding #7 survived being "fixed" in the sibling window
   * and not this one.
   */

  it("ignores Escape while the import is running", async () => {
    const { user, onClose, release } = await startHeldImport("fp3");
    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
    release();
  });

  it("disables the close control while the import is running", async () => {
    const { user, onClose, release } = await startHeldImport("fp4");
    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).not.toHaveBeenCalled();
    release();
  });

  it("ignores a backdrop click while the import is running", async () => {
    const { user, onClose, release } = await startHeldImport("fp5");
    await user.click(
      document.querySelector(".folder-settings-window-backdrop")!,
    );
    expect(onClose).not.toHaveBeenCalled();
    release();
  });

  it("can be dismissed again once the import settles", async () => {
    const { user, onClose, release } = await startHeldImport("fp6");
    release();
    await screen.findByText(/Imported 1 folder, 25 bookmarks\./);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("can be dismissed again after a failed import", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow({ folder: folderNode("fp7", "Target") });

    await chooseImportFile(
      user,
      new File(["{ not json"], "bad.json", { type: "application/json" }),
    );
    await screen.findByText("That file isn’t valid JSON.");

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });

  it("guards against navigating away while the import runs, and releases after", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");

    const { release } = await startHeldImport("fp8");
    expect(add.mock.calls.some(([type]) => type === "beforeunload")).toBe(true);

    release();
    await screen.findByText(/Imported 1 folder, 25 bookmarks\./);
    await waitFor(() =>
      expect(remove.mock.calls.some(([type]) => type === "beforeunload")).toBe(
        true,
      ),
    );
  });
});

describe("FolderSettingsWindow — focus on open", () => {
  it("focuses the Name field for an existing folder", () => {
    renderWindow({ folder: folderNode("ff1", "Work") });
    expect(screen.getByLabelText("Name")).toHaveFocus();
  });

  it("does not select the existing name, so typing extends it", async () => {
    const user = userEvent.setup();
    renderWindow({ folder: folderNode("ff2", "Work") });

    // Asserts the outcome, not the selection range: a selection assertion alone
    // would still pass if the field were unselected but never focused.
    await user.keyboard("shop");

    expect(screen.getByLabelText("Name")).toHaveValue("Workshop");
  });

  it("leaves the existing name unselected, with the caret after it", () => {
    renderWindow({ folder: folderNode("ff5", "Work") });

    const nameField = screen.getByLabelText<HTMLInputElement>("Name");
    expect(nameField).toHaveFocus();
    // Collapsed selection at the end — nothing highlighted, ready to edit.
    expect(nameField.selectionStart).toBe(nameField.selectionEnd);
    expect(nameField.selectionStart).toBe("Work".length);
  });

  it("focuses the empty Name field of the New Folder draft", async () => {
    const user = userEvent.setup();
    renderCreateWindow();

    const nameField = screen.getByLabelText("Name");
    expect(nameField).toHaveFocus();
    // Nothing to select; typing simply fills the empty field.
    await user.keyboard("Fresh");
    expect(nameField).toHaveValue("Fresh");
  });

  /**
   * The regression this window is uniquely exposed to. It re-renders
   * continuously while an import it launched reports progress inline, so a
   * focus effect with the wrong dependencies would pull the caret out of the
   * field the user is actually typing in — and would do it most aggressively
   * exactly while progress is streaming.
   */
  it("does not re-assert focus while the window stays open", async () => {
    const user = userEvent.setup();
    renderWindow({ folder: folderNode("ff3", "Work") });

    const importToggle = screen.getByRole("button", {
      name: /Import Bookmarks/,
    });
    await user.click(importToggle);

    expect(screen.getByLabelText("Name")).not.toHaveFocus();
  });

  it("keeps focus put across re-renders driven by typing", async () => {
    const user = userEvent.setup();
    renderWindow({ folder: folderNode("ff4", "Work") });

    // Each keystroke re-renders via setName. Focus must survive all of them.
    await user.keyboard("abc");
    expect(screen.getByLabelText("Name")).toHaveFocus();
    expect(screen.getByLabelText("Name")).toHaveValue("Workabc");
  });
});
