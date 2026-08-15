import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    // scripts/ holds the CI guards, which are plain TypeScript run by
    // Node 24's native type stripping. They are covered here so a guard cannot
    // rot unnoticed.
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
  },
});
