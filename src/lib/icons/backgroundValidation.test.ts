import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MAX_BACKGROUND_FILE_SIZE_BYTES,
  MAX_ICON_FILE_SIZE_BYTES,
  validateBackgroundFile,
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

function makeFile(bytes: number[], name = "bg", type = ""): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("validateBackgroundFile", () => {
  it("accepts each supported format within the size limit", async () => {
    stubImageBitmap(1920, 1080);
    for (const header of [PNG_HEADER, JPEG_HEADER, WEBP_HEADER, AVIF_HEADER]) {
      expect(await validateBackgroundFile(makeFile(header))).toEqual({
        ok: true,
      });
    }
  });

  it("rejects an unsupported format (SVG)", async () => {
    stubImageBitmap(64, 64);
    expect(
      await validateBackgroundFile(makeFile(SVG_BYTES, "bg.png", "image/png")),
    ).toEqual({ ok: false, error: "unsupported-format" });
  });

  it("accepts a file larger than the 1 MB icon cap but within the 10 MB background cap", async () => {
    stubImageBitmap(1920, 1080);
    const bytes = [
      ...PNG_HEADER,
      ...new Array(MAX_ICON_FILE_SIZE_BYTES).fill(0),
    ];
    expect(await validateBackgroundFile(makeFile(bytes))).toEqual({ ok: true });
  });

  it("rejects a file exceeding the 10 MB background cap", async () => {
    const oversized = [
      ...PNG_HEADER,
      ...new Array(MAX_BACKGROUND_FILE_SIZE_BYTES).fill(0),
    ];
    expect(await validateBackgroundFile(makeFile(oversized))).toEqual({
      ok: false,
      error: "file-too-large",
    });
  });

  it("rejects a matching-header file the browser can't decode", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new DOMException("The source image could not be decoded.");
      }),
    );
    expect(await validateBackgroundFile(makeFile(PNG_HEADER))).toEqual({
      ok: false,
      error: "unsupported-format",
    });
  });
});
