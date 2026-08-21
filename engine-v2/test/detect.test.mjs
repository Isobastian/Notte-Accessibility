/*
 * Detector test. Two pages, engine injected at document_start:
 *   - mixed:  LIGHT body + dark header + dark panel (the MeteoSvizzera shape)
 *             -> must be THEMED (light band darkened).
 *   - dark:   dark body (a real dark theme) -> must be LEFT ALONE (no theme sheet).
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = dirname(fileURLToPath(import.meta.url));
const bundle = readFileSync(join(ROOT, "..", "dist", "chrome", "content.js"), "utf8");
const stub = `window.chrome={storage:{local:{get:(d,cb)=>{const v={overrides:{}};if(cb)cb(v);return Promise.resolve(v);}},onChanged:{addListener(){}}},runtime:{sendMessage:()=>Promise.resolve({results:[]})}};`;

function lum(rgb) { const m = String(rgb).match(/(\d+)\D+(\d+)\D+(\d+)/); return m ? 0.2126*+m[1]+0.7152*+m[2]+0.0722*+m[3] : NaN; }

const browser = await chromium.launch({
  executablePath: process.env.NOTTE_CHROME || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  args: ["--no-sandbox"]
});

async function run(file) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.addInitScript(stub);
  await page.addInitScript({ content: bundle });
  await page.goto("file://" + join(ROOT, file), { waitUntil: "load" });
  await page.waitForTimeout(400);
  const r = await page.evaluate(() => ({
    themeSheet: !!document.querySelector("#__notte_theme__"),
    auto: document.documentElement.getAttribute("data-notte-auto"),
    contentBg: (() => { const e = document.querySelector(".content"); return e ? getComputedStyle(e).backgroundColor : null; })(),
    bodyBg: getComputedStyle(document.body).backgroundColor
  }));
  await page.close();
  return r;
}

let pass = 0, fail = 0;
const ok = (n, c) => { if (c) pass++; else { fail++; console.error("  ✗ " + n); } };

const mixed = await run("fixture-mixed.html");
ok("mixed page is themed (dark header didn't trigger back-off)", mixed.themeSheet === true);
ok("mixed page auto-detect = not-already-dark", mixed.auto === "false");
ok("mixed page light band darkened", lum(mixed.contentBg) < 45);

const dark = await run("fixture-darksite.html");
ok("dark-bodied site left alone (no theme sheet)", dark.themeSheet === false);
ok("dark-bodied site auto-detect = already-dark", dark.auto === "true");

console.log(`\nmixed=${JSON.stringify(mixed)}\ndark=${JSON.stringify(dark)}`);
console.log(`${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);
