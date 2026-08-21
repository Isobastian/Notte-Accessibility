/*
 * Build the loadable Chrome extension into dist/chrome/.
 *
 * 1. Bundle src/index.js -> dist/chrome/content.js as one IIFE (esbuild).
 * 2. Copy the static files (manifest, service worker, shadow-patch, popup, icons).
 *
 * One command: `npm run build`. No TypeScript, no config file — esbuild bundles
 * the plain ES modules in src/ so the engine stays modular on disk while
 * shipping as a single content.js (which tools/sync.sh can later copy into the
 * chrome/ build, exactly like today).
 */
import { build } from "esbuild";
import { mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = join(ROOT, "dist", "chrome");

mkdirSync(join(OUT, "images"), { recursive: true });

await build({
  entryPoints: [join(ROOT, "src", "index.js")],
  bundle: true,
  format: "iife",
  target: ["chrome111", "firefox113", "safari16"],
  legalComments: "none",
  outfile: join(OUT, "content.js")
});

for (const f of ["manifest.json", "background.js", "shadow-patch.js", "popup.html", "popup.js"]) {
  copyFileSync(join(ROOT, f), join(OUT, f));
}
for (const png of readdirSync(join(ROOT, "images"))) {
  if (png.endsWith(".png")) copyFileSync(join(ROOT, "images", png), join(OUT, "images", png));
}

console.log("Built dist/chrome/ — Load unpacked that folder in chrome://extensions.");
