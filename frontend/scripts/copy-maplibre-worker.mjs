// Turbopack doesn't correctly emit maplibre-gl's worker chunk (and its
// sibling maplibre-gl-shared.mjs), so the library falls back to a broken
// worker URL and the map silently never loads tiles. The fix is to serve
// both files from public/ ourselves and point maplibre-gl at them
// explicitly (see src/components/MapView.tsx, setWorkerUrl). This script
// re-copies them from node_modules on every install so they can't drift out
// of sync with the installed maplibre-gl version.
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
