import { describe, expect, it } from "vitest";
import { dataUrlToBlob } from "./dataUrl";

// "PNG" as base64 is a convenient, valid base64 payload for decode assertions.
const PNG_BASE64 = btoa("PNG");

describe("dataUrlToBlob", () => {
  it("decodes a base64 image data URL into a Blob carrying its MIME type", async () => {
    const blob = dataUrlToBlob(`data:image/png;base64,${PNG_BASE64}`);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob?.type).toBe("image/png");
    expect(await blob?.text()).toBe("PNG");
  });

  it("returns undefined for a non-data-URL string", () => {
    expect(dataUrlToBlob("https://example.com/icon.png")).toBeUndefined();
  });

  it("returns undefined for a data URL that is not base64-encoded", () => {
    expect(dataUrlToBlob("data:text/plain,hello")).toBeUndefined();
  });

  it("returns undefined for garbage / invalid base64", () => {
    expect(dataUrlToBlob("data:image/png;base64,@@@not-base64@@@")).toBe(
      undefined,
    );
  });

  it("returns undefined for an empty string", () => {
    expect(dataUrlToBlob("")).toBeUndefined();
  });
});
