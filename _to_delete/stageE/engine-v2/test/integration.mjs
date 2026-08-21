/*
 * Integration test on real Blink (Chromium via Playwright). Injects the built
 * content.js into a light fixture page — with a minimal chrome.* stub so the
 * engine's storage path resolves — and asserts the page is actually darkened
 * with high contrast, including the CSS-variable and inline-style paths that a
 * pure-JS test can't exercise (needs real CSSOM + getComputedStyle).
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const bundle = readFileSync(join(ROOT, "..", "dist", "chrome", "content.js"), "utf8");
const fixture = "file://" + join(ROOT, "fixture.html");

const chromeStub = `
  window.chrome = {
    storage: {
      local: { get: (d, cb) => { const v = { overrides: {} }; if (cb) { cb(v); } return Promise.resolve(v); } },
      onChanged: { addListener() {} }
    },
    runtime: { sendMessage: () => Promise.resolve({ results: [] }) }
  };
`;

function lum(rgb) {
  const m = String(rgb).match(/(\d+)\D+(\d+)\D+(\d+)/);
  if (!m) return NaN;
  return 0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3];
}

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.error("  ✗ " + n); } };

const browser = await chromium.launch({
  executablePath: process.env.NOTTE_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"]
});
const page = await browser.newPage();
page.on("console", (m) => console.log("[page]", m.type(), m.text()));
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.addInitScript(chromeStub);
await page.goto(fixture);
await page.addScriptTag({ content: bundle });
await page.waitForTimeout(500); // let loadAndRender + rAF inline flush run
console.log("build attr:", await page.evaluate(() => document.documentElement.getAttribute("data-notte-build")));

const g = await page.evaluate(() => {
  const cs = (sel) => {
    const el = document.querySelector(sel) || document.body;
    const s = getComputedStyle(el);
    return { bg: s.backgroundColor, color: s.color };
  };
  return {
    themeSheet: !!document.querySelector("#__notte_theme__"),
    body: cs("body"), card: cs(".card"), btn: cs(".btn"),
    panel: cs(".panel"), media: cs(".media"), inline: cs("#inline"), imp: cs(".imp"),
    rowA: cs(".rowA"), rowB: cs(".rowB"), rowC: cs(".rowC"),
    band: cs(".band"), topbar: cs(".topbar"),
    shortbg: cs(".shortbg"), chainbg: cs(".chainbg"), chaintxt: cs(".chaintxt"),
    shadow: getComputedStyle(document.querySelector(".shadowed")).boxShadow
  };
});

ok("theme sheet injected", g.themeSheet);
ok("body background darkened", lum(g.body.bg) < 40);
ok("body text lightened", lum(g.body.color) > 150);
ok("card background darkened", lum(g.card.bg) < 45);
ok("card text lightened", lum(g.card.color) > 150);
ok("card high contrast", lum(g.card.color) - lum(g.card.bg) > 120);
ok("panel via CSS variable darkened", lum(g.panel.bg) < 45);
ok("panel text lightened", lum(g.panel.color) > 150);
ok("@media rule darkened", lum(g.media.bg) < 45);
ok("site !important background overridden", lum(g.imp.bg) < 45);
ok("site !important text lightened", lum(g.imp.color) > 150);
ok("neutral rows both stay dark", lum(g.rowA.bg) < 40 && lum(g.rowB.bg) < 45);
ok("row states ordered normal<hover<selected", lum(g.rowA.bg) < lum(g.rowC.bg) && lum(g.rowC.bg) < lum(g.rowB.bg));
ok("selected clearly distinct from normal (>=8)", lum(g.rowB.bg) - lum(g.rowA.bg) >= 8);
ok("hover clearly distinct from normal (>=3)", lum(g.rowC.bg) - lum(g.rowA.bg) >= 3);
ok("bright box-shadow stroke darkened", lum(g.shadow) < 60);
ok("rgb(var()) channel-token band darkened", lum(g.band.bg) < 45);
ok("rgb(var()) channel-token band text lightened", lum(g.band.color) > 150);
ok("rgb(var()) channel-token topbar darkened", lum(g.topbar.bg) < 45);
ok("shorthand background:var() darkened", lum(g.shortbg.bg) < 45);
ok("chained token background darkened", lum(g.chainbg.bg) < 45);
ok("chained dark token used as text is lightened", lum(g.chaintxt.color) > 150);
ok("inline-style background darkened", lum(g.inline.bg) < 45);
ok("inline-style text lightened", lum(g.inline.color) > 150);
ok("button stays bluish (accent preserved)", (() => {
  const m = g.btn.bg.match(/(\d+)\D+(\d+)\D+(\d+)/);
  return m && +m[3] > +m[1] && +m[3] > +m[2];
})());

console.log(`\\n${pass} passed, ${fail} failed`);
console.log("sample:", JSON.stringify(g, null, 0).slice(0, 400));
await browser.close();
process.exit(fail ? 1 : 0);
