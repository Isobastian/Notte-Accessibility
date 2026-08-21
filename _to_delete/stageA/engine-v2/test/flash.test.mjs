/*
 * Flash test: run the engine at document_start (via addInitScript, which — like
 * a content script — executes before the page's own scripts and styles paint),
 * screencast the load via CDP, and assert no captured frame is white. This is
 * the objective "no white flash" check from design doc §7.
 */
import { chromium } from "playwright";
import { PNG } from "pngjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const bundle = readFileSync(join(ROOT, "..", "dist", "chrome", "content.js"), "utf8");
const fixture = "file://" + join(ROOT, "flash.html");
const chromeStub = `window.chrome={storage:{local:{get:(d,cb)=>{const v={overrides:{}};if(cb)cb(v);return Promise.resolve(v);}},onChanged:{addListener(){}}},runtime:{sendMessage:()=>Promise.resolve({results:[]})}};`;

function meanLuma(b64) {
  const png = PNG.sync.read(Buffer.from(b64, "base64"));
  let sum = 0, n = 0;
  // sample every 4th pixel for speed
  for (let i = 0; i < png.data.length; i += 16) {
    sum += 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
    n++;
  }
  return sum / n;
}

const browser = await chromium.launch({
  executablePath: process.env.NOTTE_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"]
});
const page = await browser.newPage({ viewport: { width: 500, height: 360 } });
await page.addInitScript(chromeStub);
await page.addInitScript({ content: bundle });   // runs at document_start, before page scripts

const client = await page.context().newCDPSession(page);
const frames = [];
client.on("Page.screencastFrame", async (f) => {
  frames.push(f.data);
  try { await client.send("Page.screencastFrameAck", { sessionId: f.sessionId }); } catch (e) {}
});
// Warm load first (so the "before" frame is the already-dark page, not the
// browser's pre-navigation blank white), then screencast a RELOAD — exactly
// the "I reloaded ASC three times and saw a flash" scenario.
await page.goto(fixture, { waitUntil: "load" });
await page.waitForTimeout(300);

await client.send("Page.enable");
await client.send("Page.startScreencast", { format: "png", everyNthFrame: 1, maxWidth: 500, maxHeight: 360 });
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(500); // capture the late-render window too
await client.send("Page.stopScreencast");
await browser.close();

let pass = 0, fail = 0;
const lumas = frames.map(meanLuma);
const maxL = lumas.length ? Math.max(...lumas) : 0;
const whiteFrames = lumas.filter((l) => l > 180).length;

const ok = (n, c) => { if (c) pass++; else { fail++; console.error("  ✗ " + n); } };
ok("captured frames", frames.length > 0);
ok("no white frame during load (max mean luma < 180)", maxL < 180);
ok("no white frames at all", whiteFrames === 0);

console.log("per-frame luma:", lumas.map((l) => l.toFixed(0)).join(", "));
console.log(`\nframes=${frames.length} maxMeanLuma=${maxL.toFixed(1)} whiteFrames=${whiteFrames}`);
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
