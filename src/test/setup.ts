import "@testing-library/jest-dom/vitest";
// jsdom has no IndexedDB implementation; iconDb.ts needs a real one to test against.
import "fake-indexeddb/auto";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

// jsdom has no ResizeObserver. This no-op baseline keeps components that
// use it from crashing in tests that don't care about resize behavior;
// tests that do (useElementSize) install a controllable fake instead.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
