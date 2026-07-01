import { afterEach, describe, expect, it, vi } from "vitest";
import { getFaviconUrl } from "./favicon";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getFaviconUrl", () => {
  it("builds a chrome-extension _favicon URL with pageUrl and size params", () => {
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-id${path}`,
      },
    });

    const result = getFaviconUrl("https://example.com/page", 32);

    expect(result.startsWith("chrome-extension://test-id/_favicon/?")).toBe(
      true,
    );
    const parsed = new URL(result);
    expect(parsed.searchParams.get("pageUrl")).toBe("https://example.com/page");
    expect(parsed.searchParams.get("size")).toBe("32");
  });

  it("defaults size to 32 when not provided", () => {
    vi.stubGlobal("chrome", {
      runtime: {
        getURL: (path: string) => `chrome-extension://test-id${path}`,
      },
    });

    const result = getFaviconUrl("https://example.com");
    expect(new URL(result).searchParams.get("size")).toBe("32");
  });
});
