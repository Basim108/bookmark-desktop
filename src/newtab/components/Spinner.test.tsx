import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Spinner } from "./Spinner";

// Resolved from the repo root (vitest's cwd) rather than import.meta.url, which
// is not a file: URL under this config.
const css = readFileSync(resolve("src/newtab/main.css"), "utf8");

describe("Spinner", () => {
  it("renders the shared spinner class", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector(".spinner")).not.toBeNull();
  });

  it("keeps any caller-supplied class alongside the shared one", () => {
    const { container } = render(<Spinner className="toast-spinner" />);
    const element = container.querySelector(".spinner");
    expect(element?.className).toBe("spinner toast-spinner");
  });

  it("is decorative, so paired status text is not announced twice", () => {
    const { container } = render(<Spinner />);
    expect(
      container.querySelector(".spinner")?.getAttribute("aria-hidden"),
    ).toBe("true");
  });

  /**
   * jsdom neither runs animations nor evaluates media queries, so the contract
   * is asserted against the stylesheet itself. Without this, the reduced-motion
   * rule could be dropped in a refactor and nothing would fail — the very
   * failure mode it exists to prevent, since it is unobservable in every other
   * test we run.
   */
  it("is animated, and stops animating under a reduced-motion preference", () => {
    expect(css).toMatch(/\.spinner\s*\{[^}]*animation:\s*spinner-rotate/);
    expect(css).toMatch(/@keyframes\s+spinner-rotate/);

    const reducedMotionBlock =
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*\.spinner\s*\{[^}]*animation:\s*none/;
    expect(css).toMatch(reducedMotionBlock);
  });
});
