import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReleaseEntry } from "../../lib/releaseNotes/parse";
import { WhatsNewWindow } from "./WhatsNewWindow";

const NOTES: ReleaseEntry = {
  version: "1.1.0",
  headsUp: "Your icons settle into place once after this update.",
  changes: ["Turn pages with your mouse wheel", "Reorder your folders"],
  fixesNote: "Alongside these, a number of fixes and refinements.",
};

const BARE: ReleaseEntry = {
  version: "1.1.0",
  changes: ["The first release"],
};

function renderWindow(
  notes: ReleaseEntry = NOTES,
  entrance: "update" | "about" = "update",
) {
  const onClose = vi.fn();
  render(
    <WhatsNewWindow notes={notes} entrance={entrance} onClose={onClose} />,
  );
  return { onClose };
}

describe("WhatsNewWindow", () => {
  it("titles itself for the news when it opened itself after an update", () => {
    renderWindow(NOTES, "update");

    expect(screen.getByRole("dialog", { name: "What's new" })).toBeVisible();
  });

  it("titles itself About when summoned from settings", () => {
    renderWindow(NOTES, "about");

    expect(screen.getByRole("dialog", { name: "About" })).toBeVisible();
  });

  it("shows the same changes from either entrance", () => {
    renderWindow(NOTES, "about");

    expect(screen.getByText("Turn pages with your mouse wheel")).toBeVisible();
    expect(screen.getByText("Reorder your folders")).toBeVisible();
  });

  it("introduces the project when summoned from settings", () => {
    renderWindow(NOTES, "about");

    expect(screen.getByRole("heading", { name: "What's new" })).toBeVisible();
    // The introduction precedes the news, which carries its own heading there.
    expect(screen.getByText(/replaces Chrome's new-tab page/i)).toBeVisible();
  });

  it("leads with the news when it opened itself after an update", () => {
    renderWindow(NOTES, "update");

    // No introduction and no section heading: the window's own title already
    // says what this is, and a blurb above the news would bury it.
    expect(
      screen.queryByText(/replaces Chrome's new-tab page/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "What's new" }),
    ).not.toBeInTheDocument();
  });

  it("leads with the heads-up when the release declares one", () => {
    renderWindow(NOTES);

    expect(screen.getByRole("note")).toHaveTextContent(
      "Your icons settle into place once after this update.",
    );
  });

  it("renders no heads-up block when the release declares none", () => {
    renderWindow(BARE);

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });

  it("shows the rolled-up fixes sentence when the release has one", () => {
    renderWindow(NOTES);

    expect(
      screen.getByText("Alongside these, a number of fixes and refinements."),
    ).toBeVisible();
  });

  it("omits the fixes sentence when the release has none", () => {
    renderWindow(BARE);

    expect(screen.queryByText(/Alongside these/)).not.toBeInTheDocument();
  });

  it("shows the running version", () => {
    renderWindow(NOTES);

    expect(screen.getByText(/1\.1\.0/)).toBeVisible();
  });

  it("closes on the close control", async () => {
    const { onClose } = renderWindow();

    await userEvent.click(
      screen.getByRole("button", { name: "Close What's new" }),
    );

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on Escape", async () => {
    const { onClose } = renderWindow();

    await userEvent.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes on a click outside the window", async () => {
    const { onClose } = renderWindow();

    await userEvent.click(screen.getByTestId("whats-new-backdrop"));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it("stays open on a click inside the window", async () => {
    const { onClose } = renderWindow();

    await userEvent.click(screen.getByRole("dialog"));

    expect(onClose).not.toHaveBeenCalled();
  });
});
