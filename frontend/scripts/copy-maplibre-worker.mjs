// Turbopack doesn't emit maplibre-gl's worker files correctly, so they're served
// from public/ (see src/components/MapView.tsx). Re-copied on every install so
// they match the installed maplibre-gl version.
import { copyFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const srcDir = join(root, "node_modules", "maplibre-gl", "dist");
const destDir = join(root, "public");

for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  const src = join(srcDir, name);
  if (!existsSync(src)) {
    console.warn(`[copy-maplibre-worker] skipped ${name}: not found in node_modules (is maplibre-gl installed?)`);
    continue;
  }
  copyFileSync(src, join(destDir, name));
}
