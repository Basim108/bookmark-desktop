import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { DndTestProvider } from "../../test/DndTestProvider";
import { Sidebar } from "./Sidebar";

const mock = installChromeMock();

function folderNode(
  id: string,
  parentId: string,
  title: string,
): chrome.bookmarks.BookmarkTreeNode {
  return { id, parentId, index: 0, title, syncing: false };
}

const BOOKMARKS_BAR = folderNode("1", "0", "Bookmarks bar");
const OTHER = folderNode("2", "0", "Other bookmarks");

/** The import toast, distinguished from dnd-kit's own live region. */
function toast() {
  return screen.getByRole("status", { name: "Import status" });
}

function queryToast() {
  return screen.queryByRole("status", { name: "Import status" });
}

function renderSidebar() {
  return render(
    <DndTestProvider>
      <Sidebar
        rootFolders={[BOOKMARKS_BAR, OTHER]}
        loading={false}
        activeFolderId="1"
        onSelectFolder={vi.fn()}
        viewportWidth={1280}
        onOpenSettings={vi.fn()}
      />
    </DndTestProvider>,
  );
}

/** A minimal valid uTab export: one folder, two bookmarks. */
function utabFile(name = "uTab_settings.json") {
  const json = JSON.stringify({
    folders: [
      {
        name: "Work",
        bookmarks: [
          { title: "A", url: "https://a.example" },
          { title: "B", url: "https://b.example" },
        ],
      },
    ],
  });
  return new File([json], name, { type: "application/json" });
}

beforeEach(() => {
  mock.reset();
  vi.clearAllMocks();
  mock.addNode(BOOKMARKS_BAR);
  mock.addNode(OTHER);
});

describe("root folder import button", () => {
  it("renders on every root row, before the add-subfolder button", () => {
    renderSidebar();

    const importButtons = screen.getAllByRole("button", {
      name: "Import uTab Bookmarks",
    });
    expect(importButtons).toHaveLength(2);

    // Ordering is part of the requirement: [import] [+].
    const row = importButtons[0]!.closest(".folder-row")!;
    const order = within(row as HTMLElement)
      .getAllByRole("button")
      .map((button) => button.getAttribute("aria-label"));
    expect(order.indexOf("Import uTab Bookmarks")).toBeLessThan(
      order.indexOf("Add subfolder"),
    );
  });

  it("carries the requested tooltip", () => {
    renderSidebar();
    expect(
      screen.getAllByRole("button", { name: "Import uTab Bookmarks" })[0],
    ).toHaveAttribute("title", "Import uTab Bookmarks");
  });

  it("does not open a folder settings window", async () => {
    // A root must never reach the settings window, whichever fields it would
    // show — that is the rule this whole entry point had to work around.
    const user = userEvent.setup();
    renderSidebar();

    await user.click(
      screen.getAllByRole("button", { name: "Import uTab Bookmarks" })[0]!,
    );

    expect(screen.queryByText("Folder Settings")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveAccessibleName(
      "Import uTab Bookmarks",
    );
  });
});

describe("import target confirmation", () => {
  it("names the target root before any file is chosen", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(
      screen.getAllByRole("button", { name: "Import uTab Bookmarks" })[0]!,
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Bookmarks bar")).toBeInTheDocument();
  });

  it("creates nothing when cancelled", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(
      screen.getAllByRole("button", { name: "Import uTab Bookmarks" })[0]!,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(queryToast()).not.toBeInTheDocument();
    // Nothing was created under the root.
    const children = await chrome.bookmarks.getChildren("1");
    expect(children).toHaveLength(0);
  });

  it("opens the file picker when confirmed", async () => {
    const user = userEvent.setup();
    const { container } = renderSidebar();
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    const click = vi.spyOn(input, "click");

    await user.click(
      screen.getAllByRole("button", { name: "Import uTab Bookmarks" })[0]!,
    );
    await user.click(screen.getByRole("button", { name: "Choose file…" }));

    expect(click).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("import progress and result", () => {
  /** Walks the flow up to and including choosing a file. */
  async function runImport(file = utabFile()) {
    const user = userEvent.setup();
    const { container } = renderSidebar();
    await user.click(
      screen.getAllByRole("button", { name: "Import uTab Bookmarks" })[0]!,
    );
    await user.click(screen.getByRole("button", { name: "Choose file…" }));
    const input =
      container.querySelector<HTMLInputElement>('input[type="file"]')!;
    await user.upload(input, file);
    return user;
  }

  it("reports the outcome and names the report file when one was written", async () => {
    await runImport();

    await waitFor(() =>
      expect(toast()).toHaveTextContent(/Imported 1 folder, 2 bookmarks/),
    );
  });

  it("keeps the result until it is acknowledged", async () => {
    const user = await runImport();
    await waitFor(() => expect(toast()).toBeInTheDocument());

    // No timer should be able to take it away.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(toast()).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "OK" }));
    expect(queryToast()).not.toBeInTheDocument();
  });

  it("reports a structurally invalid file rather than hanging", async () => {
    await runImport(new File(["not json"], "broken.json"));

    await waitFor(() =>
      expect(toast()).toHaveTextContent("That file isn’t valid JSON."),
    );
  });
});

describe("navigate-away guard", () => {
  it("registers while an import runs and releases when it settles", async () => {
    const add = vi.spyOn(window, "addEventListener");
    const remove = vi.spyOn(window, "removeEventListener");
    const user = userEvent.setup();
    const { container } = renderSidebar();

    await user.click(
      screen.getAllByRole("button", { name: "Import uTab Bookmarks" })[0]!,
    );
    await user.click(screen.getByRole("button", { name: "Choose file…" }));
    await user.upload(
      container.querySelector<HTMLInputElement>('input[type="file"]')!,
      utabFile(),
    );

    await waitFor(() =>
      expect(add.mock.calls.some(([type]) => type === "beforeunload")).toBe(
        true,
      ),
    );

    // Once the result is showing, the import has settled and the guard must be
    // gone. A handler left registered here would put a spurious "Leave site?"
    // prompt on every later navigation — a failure that only ever surfaces in
    // some unrelated flow.
    await waitFor(() => expect(toast()).toBeInTheDocument());
    await waitFor(() =>
      expect(remove.mock.calls.some(([type]) => type === "beforeunload")).toBe(
        true,
      ),
    );
  });

  it("leaves no guard behind when the sidebar unmounts mid-import", async () => {
    const remove = vi.spyOn(window, "removeEventListener");
    const user = userEvent.setup();
    const { container, unmount } = renderSidebar();

    await user.click(
      screen.getAllByRole("button", { name: "Import uTab Bookmarks" })[0]!,
    );
    await user.click(screen.getByRole("button", { name: "Choose file…" }));
    await user.upload(
      container.querySelector<HTMLInputElement>('input[type="file"]')!,
      utabFile(),
    );
    unmount();

    expect(remove.mock.calls.some(([type]) => type === "beforeunload")).toBe(
      true,
    );
  });
});

describe("one import at a time", () => {
  it("disables the import button on every root row while one is in flight", async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(
      screen.getAllByRole("button", { name: "Import uTab Bookmarks" })[0]!,
    );
    await user.click(screen.getByRole("button", { name: "Choose file…" }));

    // "picking" already counts as busy: the OS dialog is open and a second
    // import must not be startable behind it.
    for (const button of screen.getAllByRole("button", {
      name: "Import uTab Bookmarks",
    })) {
      expect(button).toBeDisabled();
    }
  });
});
