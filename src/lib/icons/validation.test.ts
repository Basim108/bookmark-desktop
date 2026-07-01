import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_ICON_DIMENSION_PX,
  MAX_ICON_FILE_SIZE_BYTES,
  sniffIconFormat,
  validateIconFile,
} from "./validation";

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEADER = [0xff, 0xd8, 0xff, 0xe0];
const WEBP_HEADER = [
  0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
];
const AVIF_HEADER = [
  0, 0, 0, 0x1c, 0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66,
];
const SVG_BYTES = [..."<svg xmlns='http://www.w3.org/2000/svg'></svg>"].map(
  (c) => c.charCodeAt(0),
);

function stubImageBitmap(width: number, height: number) {
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width, height, close: () => {} })),
  );
}

function makeFile(bytes: number[], name = "icon", type = ""): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("sniffIconFormat", () => {
  it("recognizes PNG", () => {
    expect(sniffIconFormat(new Uint8Array(PNG_HEADER))).toBe("png");
  });

  it("recognizes JPEG", () => {
    expect(sniffIconFormat(new Uint8Array(JPEG_HEADER))).toBe("jpeg");
  });

  it("recognizes WebP", () => {
    expect(sniffIconFormat(new Uint8Array(WEBP_HEADER))).toBe("webp");
  });

  it("recognizes AVIF", () => {
    expect(sniffIconFormat(new Uint8Array(AVIF_HEADER))).toBe("avif");
  });

  it("does not recognize SVG", () => {
    expect(sniffIconFormat(new Uint8Array(SVG_BYTES))).toBeUndefined();
  });

  it("does not recognize garbage bytes", () => {
    expect(sniffIconFormat(new Uint8Array([1, 2, 3, 4]))).toBeUndefined();
  });
});

describe("validateIconFile", () => {
  it("accepts a valid PNG within size and dimension limits", async () => {
    stubImageBitmap(64, 64);
    const result = await validateIconFile(makeFile(PNG_HEADER));
    expect(result).toEqual({ ok: true });
  });

  it("rejects a file whose signature doesn't match an accepted format, regardless of extension/MIME", async () => {
    stubImageBitmap(64, 64);
    const result = await validateIconFile(
      makeFile(SVG_BYTES, "icon.png", "image/png"),
    );
    expect(result).toEqual({ ok: false, error: "unsupported-format" });
  });

  it("rejects a file exceeding the max file size", async () => {
    const oversized = [
      ...PNG_HEADER,
      ...new Array(MAX_ICON_FILE_SIZE_BYTES).fill(0),
    ];
    const result = await validateIconFile(makeFile(oversized));
    expect(result).toEqual({ ok: false, error: "file-too-large" });
  });

  it("rejects a file exceeding the max pixel dimensions", async () => {
    stubImageBitmap(MAX_ICON_DIMENSION_PX + 1, 64);
    const result = await validateIconFile(makeFile(PNG_HEADER));
    expect(result).toEqual({ ok: false, error: "dimensions-too-large" });
  });

  it("accepts a file exactly at the max pixel dimensions", async () => {
    stubImageBitmap(MAX_ICON_DIMENSION_PX, MAX_ICON_DIMENSION_PX);
    const result = await validateIconFile(makeFile(PNG_HEADER));
    expect(result).toEqual({ ok: true });
  });

  it("rejects a file with a matching header that the browser can't actually decode (truncated/corrupted)", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new DOMException("The source image could not be decoded.");
      }),
    );
    const result = await validateIconFile(makeFile(PNG_HEADER));
    expect(result).toEqual({ ok: false, error: "unsupported-format" });
  });
});
