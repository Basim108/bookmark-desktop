import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IconUploadControls } from "./IconUploadControls";

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function stubImageBitmap(width: number, height: number) {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width, height, close: () => {} })),
  );
}

function pngFile(name = "icon.png"): File {
  return new File([new Uint8Array(PNG_HEADER)], name, { type: "image/png" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("IconUploadControls", () => {
  it("calls onChange(true) after a valid upload", async () => {
    stubImageBitmap(32, 32);
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <IconUploadControls
        itemId="item-1"
        hasCustomIcon={false}
        onChange={onChange}
      />,
    );

    await user.upload(screen.getByLabelText("Upload icon"), pngFile());

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(true));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an inline error and does not call onChange for a rejected file", async () => {
    stubImageBitmap(32, 32);
    const onChange = vi.fn();
    // applyAccept: false — validation must reject by real content (magic
    // bytes) even if a file were coerced past the input's accept filter.
    const user = userEvent.setup({ applyAccept: false });
    render(
      <IconUploadControls
        itemId="item-2"
        hasCustomIcon={false}
        onChange={onChange}
      />,
    );

    const svg = new File(["<svg></svg>"], "icon.svg", {
      type: "image/svg+xml",
    });
    await user.upload(screen.getByLabelText("Upload icon"), svg);

    expect(onChange).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /unsupported file type/i,
    );
  });

  it("shows a remove button only when hasCustomIcon is true, and calls onChange(false)", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <IconUploadControls
        itemId="item-3"
        hasCustomIcon={false}
        onChange={onChange}
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Remove icon" }),
    ).not.toBeInTheDocument();

    rerender(
      <IconUploadControls
        itemId="item-3"
        hasCustomIcon={true}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Remove icon" }));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(false));
  });
});
