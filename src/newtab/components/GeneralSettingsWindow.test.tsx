import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { installChromeMock } from "../../test/chromeMock";
import {
  deleteCanvasBackground,
  getCanvasBackground,
  putCanvasBackground,
} from "../../lib/storage/canvasBackground";
import { getGeneralSettings } from "../../lib/storage/generalSettings";
import type { CanvasBackground } from "../../lib/storage/schema";
import { GeneralSettingsWindow } from "./GeneralSettingsWindow";

const mock = installChromeMock();

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function stubImageBitmap() {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 1920, height: 1080, close: () => {} })),
  );
}

function pngFile(name = "bg.png"): File {
  return new File([new Uint8Array(PNG_HEADER)], name, { type: "image/png" });
}

function renderWindow(options?: {
  background?: CanvasBackground;
  savedBackgroundUrl?: string;
}) {
  const onClose = vi.fn();
  const onSaved = vi.fn();
  render(
    <GeneralSettingsWindow
      background={options?.background ?? { kind: "none" }}
      savedBackgroundUrl={options?.savedBackgroundUrl}
      onSaved={onSaved}
      onClose={onClose}
    />,
  );
  return { onClose, onSaved };
}

beforeEach(async () => {
  mock.reset();
  vi.clearAllMocks();
  await deleteCanvasBackground();
});

describe("GeneralSettingsWindow", () => {
  it("renders the Settings title and, with no background, shows a placeholder and no fit control", () => {
    renderWindow();

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("No background")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove image" }),
    ).not.toBeInTheDocument();
  });

  it("stages an uploaded image (with a fit control) and persists it only on Save", async () => {
    stubImageBitmap();
    const user = userEvent.setup();
    const { onClose, onSaved } = renderWindow();

    await user.upload(screen.getByLabelText("Upload image"), pngFile());

    await waitFor(() => {
      const preview = screen.getByRole("img", { name: "Background preview" });
      expect(preview.getAttribute("src")).toMatch(/^blob:/);
    });
    // Fit control appears, defaulting to cover.
    expect(screen.getByRole("radio", { name: "Cover" })).toBeChecked();
    // Nothing written to storage before Save.
    expect(await getCanvasBackground()).toBeUndefined();
    expect((await getGeneralSettings()).background).toEqual({ kind: "none" });

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await getCanvasBackground()).toBeDefined();
    expect((await getGeneralSettings()).background).toEqual({
      kind: "upload",
      fit: "cover",
    });
    expect(onSaved).toHaveBeenCalled();
  });

  it("saves the chosen fit mode", async () => {
    stubImageBitmap();
    const user = userEvent.setup();
    renderWindow();

    await user.upload(screen.getByLabelText("Upload image"), pngFile());
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Background preview" }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("radio", { name: "Contain" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(async () =>
      expect((await getGeneralSettings()).background).toEqual({
        kind: "upload",
        fit: "contain",
      }),
    );
  });

  it("stages a removal and clears the background on Save", async () => {
    const user = userEvent.setup();
    await putCanvasBackground(new Blob(["bytes"], { type: "image/png" }));
    const { onClose } = renderWindow({
      background: { kind: "upload", fit: "cover" },
      savedBackgroundUrl: "blob:saved",
    });

    await user.click(screen.getByRole("button", { name: "Remove image" }));
    // Placeholder returns and the fit control disappears.
    expect(screen.getByText("No background")).toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(await getCanvasBackground()).toBeUndefined();
    expect((await getGeneralSettings()).background).toEqual({ kind: "none" });
  });

  it("discards a staged upload when closed without saving", async () => {
    stubImageBitmap();
    const user = userEvent.setup();
    const { onClose } = renderWindow();

    await user.upload(screen.getByLabelText("Upload image"), pngFile());
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Background preview" }),
      ).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalled();
    expect(await getCanvasBackground()).toBeUndefined();
    expect((await getGeneralSettings()).background).toEqual({ kind: "none" });
  });

  it("closes on Escape without persisting", async () => {
    const user = userEvent.setup();
    const { onClose } = renderWindow();

    await user.keyboard("{Escape}");

    expect(onClose).toHaveBeenCalled();
    expect((await getGeneralSettings()).background).toEqual({ kind: "none" });
  });

  it("rejects an oversized file with an error and does not stage it", async () => {
    const user = userEvent.setup();
    renderWindow();

    const huge = new File([new Uint8Array(10_000_001)], "huge.png", {
      type: "image/png",
    });
    await user.upload(screen.getByLabelText("Upload image"), huge);

    expect(await screen.findByRole("alert")).toHaveTextContent(/10 MB/);
    expect(
      screen.queryByRole("img", { name: "Background preview" }),
    ).not.toBeInTheDocument();
  });
});
