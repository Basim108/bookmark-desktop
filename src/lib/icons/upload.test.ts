import { afterEach, describe, expect, it, vi } from "vitest";
import { getIcon } from "../storage/iconDb";
import { removeIcon, uploadIcon } from "./upload";

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

describe("uploadIcon", () => {
  it("stores the file's bytes in IndexedDB when valid", async () => {
    stubImageBitmap(64, 64);
    const result = await uploadIcon("item-a", pngFile());
    expect(result).toEqual({ ok: true });
    expect(await getIcon("item-a")).toBeDefined();
  });

  it("does not store anything when validation fails", async () => {
    stubImageBitmap(64, 64);
    const svg = new File(["<svg></svg>"], "icon.svg", {
      type: "image/svg+xml",
    });
    const result = await uploadIcon("item-b", svg);
    expect(result).toEqual({ ok: false, error: "unsupported-format" });
    expect(await getIcon("item-b")).toBeUndefined();
  });
});

describe("removeIcon", () => {
  it("deletes a previously stored icon", async () => {
    stubImageBitmap(64, 64);
    await uploadIcon("item-c", pngFile());
    await removeIcon("item-c");
    expect(await getIcon("item-c")).toBeUndefined();
  });
});
