import { defineManifest } from "@crxjs/vite-plugin";
import pkg from "./package.json";

export default defineManifest({
  manifest_version: 3,
  name: "Bookmark Desktop",
  description: pkg.description,
  version: pkg.version,
  // Links the chrome://extensions entry and the store listing back to the repo.
  homepage_url: pkg.homepage,
  permissions: ["bookmarks", "storage", "favicon"],
  chrome_url_overrides: {
    newtab: "src/newtab/index.html",
  },
  background: {
    service_worker: "src/background/index.ts",
    type: "module",
  },
  icons: {
    16: "public/icons/icon-16.png",
    32: "public/icons/icon-32.png",
    48: "public/icons/icon-48.png",
    128: "public/icons/icon-128.png",
  },
});
