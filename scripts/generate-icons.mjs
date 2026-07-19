// Renders the extension's PNG icon sizes from the SVG master.
// Run with: npm run icons:generate
//
// Each size is rendered natively at its target width (not render-then-resize),
// which keeps small sizes crisp. The generated PNGs are committed, so a normal
// build never needs an image toolchain — this only runs when the logo changes.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(resolve(root, "src/assets/logo.svg"), "utf8");
const outDir = resolve(root, "public/icons");
const sizes = [16, 32, 48, 128];

mkdirSync(outDir, { recursive: true });

for (const size of sizes) {
  const png = new Resvg(svg, {
    fitTo: { mode: "width", value: size },
  })
    .render()
    .asPng();
  const outPath = resolve(outDir, `icon-${size}.png`);
  writeFileSync(outPath, png);
  console.log(`wrote ${outPath} (${size}x${size}, ${png.length} bytes)`);
}
