import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    trace: "on-first-retry",
  },
  // Assertions after a chrome.bookmarks write (move/create) sometimes wait
  // on a subsequent chrome.bookmarks read to observe it — a real extension
  // API round trip, not just DOM/network. Under a loaded runner this can
  // occasionally take longer than Playwright's 5s default.
  expect: {
    timeout: 10_000,
  },
});
