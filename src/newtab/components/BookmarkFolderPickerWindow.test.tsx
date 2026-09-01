import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import type { FolderPickerEntry } from "../../lib/bookmarks/folderPicker";
import { BookmarkFolderPickerWindow } from "./BookmarkFolderPickerWindow";

const folders: FolderPickerEntry[] = [
  {
    id: "root",
    name: "Bookmarks Bar",
    path: "Bookmarks Bar",
    children: [
      {
        id: "current",
        name: "Work",
        path: "Bookmarks Bar › Work",
        children: [],
      },
      {
        id: "archive",
        name: "Archive",
        path: "Bookmarks Bar › Archive",
        children: [
          {
            id: "project",
            name: "Old Projects",
            path: "Bookmarks Bar › Archive › Old Projects",
            children: [],
          },
        ],
      },
    ],
  },
];

it("searches folder names and shows matching full paths only", async () => {
  const user = userEvent.setup();
  render(
    <BookmarkFolderPickerWindow
      operation="copy"
      bookmarkTitle="Example"
      sourceFolderId="current"
      folders={folders}
      onConfirm={vi.fn()}
      onClose={vi.fn()}
    />,
  );
  await user.type(
    screen.getByRole("searchbox", { name: "Search folders" }),
    "projects",
  );
  expect(
    screen.getByText("Bookmarks Bar › Archive › Old Projects"),
  ).toBeVisible();
  expect(screen.queryByText("Bookmarks Bar › Archive")).not.toBeInTheDocument();
});

it("disables OK for no selection and the current folder, then submits another folder once", async () => {
  const user = userEvent.setup();
  let resolve!: () => void;
  const onConfirm = vi.fn(() => new Promise<void>((done) => (resolve = done)));
  render(
    <BookmarkFolderPickerWindow
      operation="move"
      bookmarkTitle="Example"
      sourceFolderId="current"
      folders={folders}
      onConfirm={onConfirm}
      onClose={vi.fn()}
    />,
  );
  const ok = screen.getByRole("button", { name: "OK" });
  expect(ok).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Work" }));
  expect(ok).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Bookmarks Bar" }));
  expect(ok).toBeEnabled();
  await user.click(ok);
  expect(ok).toBeDisabled();
  await user.click(ok);
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onConfirm).toHaveBeenCalledWith("root");
  resolve();
  await waitFor(() => expect(onConfirm).toHaveBeenCalledTimes(1));
});

it("shows an inline error and stays open when confirmation fails", async () => {
  const user = userEvent.setup();
  render(
    <BookmarkFolderPickerWindow
      operation="copy"
      bookmarkTitle="Example"
      sourceFolderId="current"
      folders={folders}
      onConfirm={vi.fn().mockRejectedValue(new Error("failed"))}
      onClose={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("button", { name: "Bookmarks Bar" }));
  await user.click(screen.getByRole("button", { name: "OK" }));
  expect(await screen.findByRole("alert")).toHaveTextContent(
    "could not be copied",
  );
  expect(screen.getByRole("dialog")).toBeVisible();
});
