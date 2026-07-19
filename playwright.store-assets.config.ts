import { defineConfig } from "@playwright/test";

/**
 * Separate from playwright.config.ts so the asset capture never runs as part of
 * the e2e suite: it writes binary files and asserts nothing, so including it in
 * CI would produce artifacts on every run. Run via `npm run assets:store`.
 */
export default defineConfig({
  testDir: "./store-assets",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  // Warming the favicon cache visits a dozen real sites.
  timeout: 180_000,
});
