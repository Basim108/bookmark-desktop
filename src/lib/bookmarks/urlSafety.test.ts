import { describe, expect, it } from "vitest";
import { isSafeNavigationUrl } from "./urlSafety";

describe("isSafeNavigationUrl", () => {
  it("allows http and https URLs", () => {
    expect(isSafeNavigationUrl("http://example.com")).toBe(true);
    expect(isSafeNavigationUrl("https://example.com/path?q=1")).toBe(true);
  });

  it("allows file URLs", () => {
    expect(isSafeNavigationUrl("file:///home/user/notes.txt")).toBe(true);
  });

  it("blocks javascript: URLs", () => {
    expect(isSafeNavigationUrl("javascript:alert(1)")).toBe(false);
  });

  it("blocks data: URLs", () => {
    expect(
      isSafeNavigationUrl("data:text/html,<script>alert(1)</script>"),
    ).toBe(false);
  });

  it("blocks chrome: and other internal schemes", () => {
    expect(isSafeNavigationUrl("chrome://settings")).toBe(false);
    expect(isSafeNavigationUrl("chrome-extension://abc/page.html")).toBe(false);
  });

  it("blocks unparseable URLs", () => {
    expect(isSafeNavigationUrl("not a url")).toBe(false);
  });
});
