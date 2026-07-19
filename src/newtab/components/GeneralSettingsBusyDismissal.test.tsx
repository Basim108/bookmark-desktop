import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import { EXPORT_FORMAT_VERSION } from "../../lib/transfer/version";
import type { ImportResult } from "../../lib/transfer/importState";
import { GeneralSettingsWindow } from "./GeneralSettingsWindow";

// The window is only `busy` for as long as importState is in flight, and a real
// import in jsdom finishes within a tick — far too fast to interact with. Mock
// it so the test holds the import open across the dismissal attempts.
const { importStateMock } = vi.hoisted(() => ({ importStateMock: vi.fn() }));
vi.mock("../../lib/transfer/importState", () => ({
  importState: importStateMock,
}));

const mock = installChromeMock();

function root(id: string, title: string, index: number) {
  return { id, parentId: "0", title, index, syncing: false } as const;
}

function backupFileJson(): string {
  return JSON.stringify({
    version: EXPORT_FORMAT_VERSION,
    roots: { "1": { title: "Bookmarks Bar", children: [] } },
    general: {
      sidebarWidth: 240,
      generalSettings: { background: { kind: "none" } },
      canvasBackgroundIcon: null,
      defaultFolderIcon: null,
    },
  });
}

function renderWindow() {
  const onClose = vi.fn();
  render(
    <GeneralSettingsWindow
      background={{ kind: "none" }}
      savedBackgroundUrl={undefined}
      onSaved={vi.fn()}
      onClose={onClose}
    />,
  );
  return { onClose };
}

/**
 * Starts an import and leaves it in flight with the confirmation already
 * answered, so the window is `busy` with no overlay showing. Getting past the
 * confirmation matters: while it is open the window is undismissable anyway,
 * which would make these assertions pass regardless of the busy guard.
 * Returns the resolver that finishes the import.
 */
async function startHangingImport(user: ReturnType<typeof userEvent.setup>) {
  let finish!: (result: ImportResult) => void;
  importStateMock.mockImplementation(
    async (_text: string, hooks: { confirmImport?: () => unknown }) => {
      await hooks.confirmImport?.();
      return new Promise<ImportResult>((resolve) => {
        finish = resolve;
      });
    },
  );

  await user.upload(
    screen.getByLabelText("Import backup file"),
    new File([backupFileJson()], "backup.json", { type: "application/json" }),
  );

  // Answer the prompt with "No" (import without a backup).
  const confirm = await screen.findByRole("alertdialog", {
    name: "Import Bookmarks",
  });
  await user.click(within(confirm).getByRole("button", { name: "No" }));

  // The confirmation is gone and the import is still running: busy, no overlay.
  await waitFor(() =>
    expect(
      screen.queryByRole("alertdialog", { name: "Import Bookmarks" }),
    ).not.toBeInTheDocument(),
  );
  return finish;
}

beforeEach(() => {
  mock.reset();
  vi.clearAllMocks();
  mock.addNode(root("1", "Bookmarks Bar", 0));
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ close: () => {} })),
  );
  URL.createObjectURL = vi.fn(() => "blob:stub");
  URL.revokeObjectURL = vi.fn();
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...window.location, reload: vi.fn() },
  });
});

describe("GeneralSettingsWindow — cannot be dismissed mid-import", () => {
  // Dismissing unmounts the window while importState keeps running: the report
  // still auto-downloads with nothing on screen to explain it, and the summary
  // and reload prompt are lost.
  it("Escape does not close the window while an import is running", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow();
    const finish = await startHangingImport(user);

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();

    finish({ ok: true, foldersCreated: 0, bookmarksCreated: 0, skipped: [] });
  });

  it("the close control does not close the window while an import is running", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow();
    const finish = await startHangingImport(user);

    const close = screen.queryByRole("button", { name: "Close" });
    if (close) {
      expect(close).toBeDisabled();
      await user.click(close);
    }
    expect(onClose).not.toHaveBeenCalled();

    finish({ ok: true, foldersCreated: 0, bookmarksCreated: 0, skipped: [] });
  });

  it("a backdrop click does not close the window while an import is running", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow();
    const finish = await startHangingImport(user);

    const backdrop = document.querySelector(
      ".general-settings-window-backdrop",
    );
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as Element);
    expect(onClose).not.toHaveBeenCalled();

    finish({ ok: true, foldersCreated: 0, bookmarksCreated: 0, skipped: [] });
  });

  it("Escape closes normally once the import has finished", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow();
    const finish = await startHangingImport(user);

    // A denial is the finish path that leaves the window standing: a clean
    // success reloads the page and a partial success holds a summary open, so
    // neither returns the window to its ordinary dismissable state.
    finish({ ok: false, denied: "too-new" });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Import" })).toBeEnabled(),
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
