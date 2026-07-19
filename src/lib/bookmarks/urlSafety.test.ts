import { describe, expect, it } from "vitest";
import { isSafeNavigationUrl } from "./urlSafety";

describe("isSafeNavigationUrl", () => {
  it("allows http and https URLs", () => {
    expect(isSafeNavigationUrl("http://example.com")).toBe(true);
    expect(isSafeNavigationUrl("https://example.com/path?q=1")).toBe(true);
  });

  // Both were on the allowlist until they were found to be undeliverable:
  // Chrome dropped FTP in v88, and a file: navigation from the new-tab page is
  // blocked without an explicit "Allow access to file URLs" grant, so a click
  // on either silently did nothing.
  it("blocks file URLs, which cannot navigate from the new-tab page", () => {
    expect(isSafeNavigationUrl("file:///home/user/notes.txt")).toBe(false);
  });

  it("blocks ftp URLs, which Chrome no longer supports", () => {
    expect(isSafeNavigationUrl("ftp://files.example.com/pub")).toBe(false);
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
