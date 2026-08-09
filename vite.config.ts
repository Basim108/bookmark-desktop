import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";
import pkg from "./package.json";
import { parseReleaseEntry } from "./src/lib/releaseNotes/parse";

/**
 * Fails the build when CHANGELOG.md carries no readable entry for the version
 * being built.
 *
 * The extension shows its release notes in a window after an update, and the
 * notes are inlined from CHANGELOG.md. Without this guard a forgotten or
 * malformed entry ships as a notice window that opens empty — a defect visible
 * only to users, and only after the release. Failing here turns it into a
 * failed build.
 */
function verifyChangelogEntry(): Plugin {
  return {
    name: "verify-changelog-entry",
    buildStart() {
      const source = readFileSync(
        new URL("./CHANGELOG.md", import.meta.url),
        "utf8",
      );
      // Throws, naming the version, when the entry is missing or unreadable.
      parseReleaseEntry(source, pkg.version);
    },
  };
}

export default defineConfig({
  plugins: [verifyChangelogEntry(), react(), crx({ manifest })],
  server: {
    port: 5173,
    strictPort: true,
  },
});
