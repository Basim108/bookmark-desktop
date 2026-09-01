import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, it, vi } from "vitest";
import { BookmarkActionMenu } from "./BookmarkActionMenu";

it("renders actions in order and supports arrow-key activation", async () => {
  const user = userEvent.setup();
  const onMove = vi.fn();
  const anchorRef = createRef<HTMLButtonElement>();
  render(
    <>
      <button ref={anchorRef}>Gear</button>
      <BookmarkActionMenu
        anchorRef={anchorRef}
        onCopy={vi.fn()}
        onMove={onMove}
        onSettings={vi.fn()}
        onClose={vi.fn()}
      />
    </>,
  );
  const items = screen.getAllByRole("menuitem");
  expect(items.map((item) => item.textContent)).toEqual([
    "Copy To...",
    "Move To...",
    "Settings",
  ]);
  expect(items[0]).toHaveFocus();
  await user.keyboard("{ArrowDown}{Enter}");
  expect(onMove).toHaveBeenCalledOnce();
});

it("closes on Escape and restores focus to the gear", () => {
  const onClose = vi.fn();
  const anchorRef = createRef<HTMLButtonElement>();
  render(
    <>
      <button ref={anchorRef}>Gear</button>
      <BookmarkActionMenu
        anchorRef={anchorRef}
        onCopy={vi.fn()}
        onMove={vi.fn()}
        onSettings={vi.fn()}
        onClose={onClose}
      />
    </>,
  );
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledOnce();
  expect(anchorRef.current).toHaveFocus();
});
