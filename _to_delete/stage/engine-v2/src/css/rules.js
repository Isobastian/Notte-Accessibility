/*
 * Rule-level transform. Walks a CSSOM rule list (CSSStyleRule, @media,
 * @supports, @import, nested rules) and emits override CSS text: the same
 * selectors, carrying only the color declarations, remapped and marked
 * !important. The browser's own cascade then applies our dark colors — to
 * elements that don't exist yet and to state changes (:hover, .selected .child)
 * the site drives, which is exactly the firefighting v1 had to do by hand.
 */
import { transformValue } from "./values.js";

// property name -> role ("fg" | "bg" | "br"), or null to ignore.
function roleFor(prop, masked) {
  switch (prop) {
    case "color":
    case "text-decoration-color":
    case "-webkit-text-fill-color":
    case "caret-color":
    case "text-emphasis-color":
      return "fg";
    case "background-color":
      // Masked elements (mask-image icons) use background-color as the icon's
      // FOREGROUND color, not a panel background — remap as text so the icon
      // stays visible on dark (v1's Wikipedia-hamburger fix).
      return masked ? "fg" : "bg";
    case "background":
    case "background-image":
      return "bg";
    case "border-color":
    case "border-top-color":
    case "border-right-color":
    case "border-bottom-color":
    case "border-left-color":
    case "border-block-color":
    case "border-block-start-color":
    case "border-block-end-color":
    case "border-inline-color":
    case "border-inline-start-color":
    case "border-inline-end-color":
    case "border":
    case "border-top":
    case "border-right":
    case "border-bottom":
    case "border-left":
    case "outline":
    case "outline-color":
    case "column-rule-color":
      return "br";
    default:
      // CSS custom-property *definition*: transform the value, role auto
      // (picked from the value's own lightness — see remapAuto).
      if (prop.length > 2 && prop[0] === "-" && prop[1] === "-") return "auto";
      return null;
  }
}

// NB (first pass, intentional): box-shadow / text-shadow / fill / stroke are
// left untouched. Shadows risk visible halos when lightened; fill/stroke risk
// recoloring icon glyphs. These are the documented next-iteration seams.

// Transform a CSSStyleDeclaration (from a rule OR an element's inline style)
// into an array of "prop:value !important" strings — only the color
// declarations that actually changed. Shared by rule and inline transforms.
export function transformDeclaration(style, theme) {
  if (!style) return [];
  var mi = style.getPropertyValue("mask-image") || style.getPropertyValue("-webkit-mask-image");
  var masked = !!mi && mi !== "none";

  var decls = [];
  for (var i = 0; i < style.length; i++) {
    var prop = style[i];
    var role = roleFor(prop, masked);
    if (role === null) continue;
    var value = style.getPropertyValue(prop);
    if (!value) continue;
    var out = transformValue(value, role, theme);
    if (out !== value) decls.push(prop + ":" + out + " !important");
  }
  return decls;
}

function transformStyleRule(rule, theme) {
  if (!rule.selectorText) return "";
  var decls = transformDeclaration(rule.style, theme);
  if (!decls.length) return "";
  return rule.selectorText + "{" + decls.join(";") + "}";
}

export function walkRules(rules, theme, ctx) {
  if (!rules) return;
  for (var idx = 0; idx < rules.length; idx++) {
    try { handleRule(rules[idx], theme, ctx); } catch (e) { /* one bad rule never stops the rest */ }
  }
}

function handleRule(rule, theme, ctx) {
  var cn = (rule.constructor && rule.constructor.name) || "";

  if (cn === "CSSKeyframesRule") return;                 // never emit @keyframes stops as top-level rules

  // Style rule (possibly with nested rules — CSS Nesting)
  if (rule.selectorText !== undefined && rule.style) {
    var text = transformStyleRule(rule, theme);
    if (text) ctx.out.push(text);
    if (rule.cssRules && rule.cssRules.length) {
      var sub = { out: [], cors: ctx.cors };
      walkRules(rule.cssRules, theme, sub);
      if (sub.out.length) ctx.out.push(rule.selectorText + "{" + sub.out.join("") + "}");
    }
    return;
  }

  // @import
  if (rule.styleSheet !== undefined && rule.href) {
    var nested = null;
    try { nested = rule.styleSheet && rule.styleSheet.cssRules; } catch (e) { nested = null; }
    if (nested) walkRules(nested, theme, ctx);
    else ctx.cors.push(rule.href);                       // cross-origin @import: re-fetch later
    return;
  }

  // Grouping rules (@media / @supports / @container / @layer …)
  if (rule.cssRules) {
    var sub2 = { out: [], cors: ctx.cors };
    walkRules(rule.cssRules, theme, sub2);
    if (!sub2.out.length) return;
    var inner = sub2.out.join("");
    if (cn === "CSSMediaRule" && rule.media) {
      ctx.out.push("@media " + rule.media.mediaText + "{" + inner + "}");
    } else if (cn === "CSSSupportsRule" && rule.conditionText !== undefined) {
      ctx.out.push("@supports " + rule.conditionText + "{" + inner + "}");
    } else {
      // @container / @layer / unknown grouping: emit contents unwrapped. Worst
      // case a color applies slightly more broadly than its condition — a minor,
      // documented trade-off vs. mis-serialising an at-rule we don't model yet.
      ctx.out.push(inner);
    }
    return;
  }
  // @font-face, @page, @property, bare @layer, etc. — nothing to color.
}
