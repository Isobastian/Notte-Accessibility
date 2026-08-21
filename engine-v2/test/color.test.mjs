/*
 * Pure-function tests for the color model + value transform. These are the
 * parts we can verify without a DOM. Run: npm test
 */
import { parseColor } from "../src/color/parse.js";
import { remap, remapAuto, remapShadow } from "../src/color/remap.js";
import { luminance, rgbToHsl, contrastRatio } from "../src/color/convert.js";
import { transformValue, transformVarDef } from "../src/css/values.js";

let pass = 0, fail = 0;
function ok(name, cond) {
  if (cond) { pass++; }
  else { fail++; console.error("  ✗ " + name); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= (tol == null ? 2 : tol); }

// rough WCAG contrast from two {r,g,b}
function rl(c) {
  const s = [c.r, c.g, c.b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
}
function contrast(a, b) {
  const la = rl(a), lb = rl(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}
function rgbaStr(s) {
  const m = s.match(/rgba?\(([^)]+)\)/);
  const p = m[1].split(",").map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] };
}

/* ---- parseColor ---- */
ok("hex #fff", (() => { const c = parseColor("#fff"); return c.r === 255 && c.g === 255 && c.b === 255; })());
ok("hex #ff000080 alpha", (() => { const c = parseColor("#ff000080"); return c.r === 255 && c.g === 0 && approx(c.a * 255, 128, 2); })());
ok("rgb comma", (() => { const c = parseColor("rgb(10,20,30)"); return c.r === 10 && c.g === 20 && c.b === 30; })());
ok("rgb modern space/slash", (() => { const c = parseColor("rgb(10 20 30 / 0.5)"); return c.r === 10 && c.b === 30 && approx(c.a, 0.5, 0.01); })());
ok("named white", (() => { const c = parseColor("white"); return c.r === 255 && c.b === 255; })());
ok("hsl", (() => { const c = parseColor("hsl(0 100% 50%)"); return c.r === 255 && c.g === 0 && c.b === 0; })());
ok("transparent", (() => { const c = parseColor("transparent"); return c.a === 0; })());
ok("currentColor -> null", parseColor("currentColor") === null);
ok("garbage -> null", parseColor("1px") === null);

/* ---- remap bands ---- */
{
  const darkBg = rgbaStr(remap({ r: 255, g: 255, b: 255, a: 1 }, "bg"));
  ok("white bg -> dark", luminance(darkBg) < 45);
  const lightFg = rgbaStr(remap({ r: 0, g: 0, b: 0, a: 1 }, "fg"));
  ok("black text -> bright", luminance(lightFg) >= 200);
  const acc = rgbaStr(remap({ r: 37, g: 99, b: 235, a: 1 }, "bg"));
  ok("blue accent keeps hue (bluish)", acc.b > acc.r && acc.b > acc.g);
  // already-dark surface stays dark (continuous map, not flipped to light)
  ok("already-dark surface stays dark", luminance(rgbaStr(remap({ r: 20, g: 24, b: 33, a: 1 }, "bg"))) < 45);
  // near-neutral navy keeps its blue tint instead of flattening to grey
  const navy = rgbaStr(remap({ r: 232, g: 236, b: 245, a: 1 }, "bg"));
  ok("near-neutral navy keeps a blue tint", navy.b >= navy.r);
  // vivid accent bg stays colored (medium-dark, not neon, not near-black)
  const vivid = rgbaStr(remap({ r: 26, g: 115, b: 232, a: 1 }, "bg"));
  ok("vivid accent bg stays blue", vivid.b > vivid.r && vivid.b > vivid.g);
  ok("vivid accent bg is muted (not full saturation)", rgbToHsl(vivid.r, vivid.g, vivid.b).s <= rgbToHsl(26, 115, 232).s);
}

/* ---- guaranteed high contrast (the whole point) ---- */
{
  const bg = rgbaStr(remap({ r: 255, g: 255, b: 255, a: 1 }, "bg"));
  const fg = rgbaStr(remap({ r: 0, g: 0, b: 0, a: 1 }, "fg"));
  ok("white/black remap contrast >= 7 (AAA)", contrast(bg, fg) >= 7);
  const bg2 = rgbaStr(remap({ r: 240, g: 240, b: 240, a: 1 }, "bg"));
  const fg2 = rgbaStr(remap({ r: 51, g: 51, b: 51, a: 1 }, "fg")); // #333 text on #f0f0f0
  ok("greys remap contrast >= 4.5 (AA)", contrast(bg2, fg2) >= 4.5);
}

/* ---- neutral greys stay differentiated (OWA rows: white/hover/selected) ---- */
{
  const white = rgbaStr(remap({ r: 255, g: 255, b: 255, a: 1 }, "bg"));     // base
  const hover = rgbaStr(remap({ r: 243, g: 242, b: 241, a: 1 }, "bg"));     // #f3f2f1
  const selected = rgbaStr(remap({ r: 225, g: 223, b: 221, a: 1 }, "bg")); // #e1dfdd
  ok("all neutral rows stay dark", luminance(white) < 40 && luminance(selected) < 45);
  ok("hover lighter than base", luminance(hover) > luminance(white));
  ok("selected lighter than hover", luminance(selected) > luminance(hover));
  ok("differentiation is perceptible", luminance(selected) - luminance(white) >= 1);
}

/* ---- Contrast targets: neutral text AA 4.5, accents vivid at >=3 ---- */
{
  const BG = { r: 44, g: 44, b: 44 };  // lightest surface in our band
  const neutral = [{ r: 0, g: 0, b: 0 }, { r: 51, g: 51, b: 51 }, { r: 120, g: 120, b: 120 }];
  let worstN = 99;
  for (const c of neutral) worstN = Math.min(worstN, contrastRatio(rgbaStr(remap(c, "fg")), BG));
  ok("neutral text meets WCAG AA (>=4.5) on dark surface", worstN >= 4.5);

  const red = rgbaStr(remap({ r: 216, g: 35, b: 42 }, "fg"));   // brand red accent
  ok("accent red stays readable (>=3:1)", contrastRatio(red, BG) >= 3);
  ok("accent red stays vivid (keeps saturation)", rgbToHsl(red.r, red.g, red.b).s >= 45);
  ok("accent red still reads as red", red.r > red.g + 60 && red.r > red.b + 60);

  // accent red as a BORDER (active-tab underline) stays a bright red line
  const redBr = rgbaStr(remap({ r: 216, g: 35, b: 42 }, "br"));
  ok("accent border stays red", redBr.r > redBr.g + 60 && redBr.r > redBr.b + 60);
  ok("accent border is bright/visible", luminance(redBr) > 70);
  // neutral border still greys out
  const greyBr = rgbaStr(remap({ r: 221, g: 221, b: 221 }, "br"));
  ok("neutral border is grey", Math.abs(greyBr.r - greyBr.g) < 12 && Math.abs(greyBr.g - greyBr.b) < 12);

  // accent red as a BACKGROUND (selected highlight) stays a colored red surface
  const redBg = rgbaStr(remap({ r: 216, g: 35, b: 42 }, "bg"));
  ok("accent bg reads as red", redBg.r > redBg.g + 40 && redBg.r > redBg.b + 40);
  ok("accent bg is not near-black", luminance(redBg) > 35);
  // neutral surface still harmonizes dark
  ok("neutral bg still near-black", luminance(rgbaStr(remap({ r: 245, g: 245, b: 245 }, "bg"))) < 45);
}

/* ---- box-shadow: bright stroke darkened, dark shadow kept ---- */
{
  const bright = rgbaStr(remapShadow({ r: 255, g: 255, b: 255, a: 1 }));
  ok("bright shadow stroke darkened", luminance(bright) < 40);
  const dark = rgbaStr(remapShadow({ r: 0, g: 0, b: 0, a: 0.1 }));
  ok("normal dark shadow kept dark (no halo)", luminance(dark) < 20);
  ok("box-shadow value: color darkened, geometry kept", (() => {
    const out = transformValue("0 0 0 1px #ffffff", "shadow");
    return out.startsWith("0 0 0 1px ") && out.indexOf("#ffffff") === -1 && out.indexOf("rgba(") !== -1;
  })());
  ok("dark drop shadow value unchanged", transformValue("0 1px 3px rgba(0,0,0,0.1)", "shadow").indexOf("rgba(0,0,0,0.1)") !== -1 || transformValue("0 1px 3px rgba(0,0,0,0.1)", "shadow").indexOf("rgba(0,0,0,0.1)".replace(/ /g,"")) !== -1);
}

/* ---- raw rgb-channel design tokens (MeteoSvizzera / mch pattern) ---- */
function chanLuma(s) { const m = s.match(/(\d+)\D+(\d+)\D+(\d+)/); return 0.2126*+m[1]+0.7152*+m[2]+0.0722*+m[3]; }
ok("light channel token darkened (space sep)", (() => {
  const out = transformVarDef("233 237 240"); return out.indexOf(",") === -1 && chanLuma(out) < 40;
})());
ok("light channel token darkened (comma sep, keeps commas)", (() => {
  const out = transformVarDef("224, 228, 232"); return out.indexOf(",") !== -1 && chanLuma(out) < 40;
})());
ok("dark channel token lightened", chanLuma(transformVarDef("30 40 50")) > 150);
ok("channel token preserves alpha slash", transformVarDef("233 237 240 / 0.6").indexOf("/ 0.6") !== -1);
ok("literal-color token still works", transformVarDef("#ffffff").indexOf("rgba(") === 0 || transformVarDef("#ffffff").indexOf("rgb") === 0);
ok("non-color token untouched", transformVarDef("12px") === "12px");
ok("three-number non-color over 255 untouched", transformVarDef("300 400 500") === "300 400 500");

/* ---- remapAuto role by luminance ---- */
{
  const a1 = rgbaStr(remapAuto({ r: 255, g: 255, b: 255, a: 1 })); // light token -> bg (dark)
  ok("remapAuto(white) darkens", luminance(a1) < 40);
  const a2 = rgbaStr(remapAuto({ r: 17, g: 17, b: 17, a: 1 }));    // dark token -> fg (light)
  ok("remapAuto(#111) brightens", luminance(a2) > 180);
}

/* ---- transformValue ---- */
ok("border shorthand keeps structure", (() => {
  const out = transformValue("1px solid #ffffff", "br");
  return out.startsWith("1px solid ") && out.indexOf("#ffffff") === -1 && out.indexOf("rgba(") !== -1;
})());
ok("gradient both stops transformed", (() => {
  const out = transformValue("linear-gradient(#ffffff, #000000)", "bg");
  return out.indexOf("#ffffff") === -1 && out.indexOf("#000000") === -1 && out.indexOf("linear-gradient(") === 0;
})());
ok("var() untouched", transformValue("var(--x)", "bg") === "var(--x)");
ok("url() untouched", transformValue("url(a.png) no-repeat", "bg") === "url(a.png) no-repeat");
ok("non-color untouched", transformValue("12px", "fg") === "12px");
ok("rgba alpha preserved", (() => {
  const out = transformValue("rgba(255,255,255,0.5)", "bg");
  return /0?\.5\)/.test(out);
})());

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
