/*
 * Rule-level transform. Walks a CSSOM rule list and emits override CSS text.
 *
 * CSS custom properties (design tokens) are the hard part. A token like
 *   --wb-ds-color-secondary--3x-dark: #1c2834
 * is DARK, but it's a dark *surface* color. Blindly picking a role from its
 * lightness (remapAuto) lightens it — turning dark sections light. So instead,
 * for every color token we define THREE role-specific variants:
 *   --nt-bg--<name>  (remap as background)
 *   --nt-fg--<name>  (remap as text)
 *   --nt-br--<name>  (remap as border)
 * and rewrite each `var(--name)` usage to the variant matching the property it
 * appears in. A token used as a background is darkened-as-a-surface; the same
 * token used as text is lightened-as-text. This is Dark Reader's approach and
 * it's what makes token-driven sites (MeteoSvizzera / the Swiss WB design
 * system) theme coherently instead of inverting at random.
 */
import { transformValue, transformVarDef } from "./values.js";
import { parseColor } from "../color/parse.js";
import { remap } from "../color/remap.js";

var EMPTY = { has: function () { return false; } };

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
    case "box-shadow":
    case "-webkit-box-shadow":
      return "shadow";
    default:
      if (prop.length > 2 && prop[0] === "-" && prop[1] === "-") return "auto";
      return null;
  }
}

// The variant custom-property name for a token used in a given role.
function variantName(role, name) { return "--nt-" + role + name; }

// Rewrite `var(--known-token …)` -> `var(--nt-<role>--known-token …)` so the
// usage picks the role-appropriate variant. Only rewrites tokens we know are
// colors (colorVars); leaves size/other tokens and unknown vars untouched.
function rewriteVars(value, role, colorVars) {
  if (!value || value.indexOf("var(") === -1) return value;
  var short = (role === "shadow") ? "bg" : role; // shadows reuse the bg variant
  return value.replace(/var\(\s*(--[A-Za-z0-9_-]+)/g, function (m, name) {
    return colorVars.has(name) ? "var(" + variantName(short, name) : m;
  });
}

// Transform a CSSStyleDeclaration into "prop:value !important" strings.
// For color custom-property definitions it emits the three role variants
// instead of overriding the original token (so we never guess its role wrong).
export function transformDeclaration(style, theme, colorVars) {
  if (!style) return [];
  colorVars = colorVars || EMPTY;
  var mi = style.getPropertyValue("mask-image") || style.getPropertyValue("-webkit-mask-image");
  var masked = !!mi && mi !== "none";

  var decls = [];
  for (var i = 0; i < style.length; i++) {
    var prop = style[i];
    var role = roleFor(prop, masked);
    if (role === null) continue;
    var value = style.getPropertyValue(prop);
    if (!value) continue;

    if (role === "auto") {
      // custom-property definition
      var c = parseColor(value.trim());
      if (c) {
        decls.push(variantName("bg", prop) + ":" + remap(c, "bg", theme) + " !important");
        decls.push(variantName("fg", prop) + ":" + remap(c, "fg", theme) + " !important");
        decls.push(variantName("br", prop) + ":" + remap(c, "br", theme) + " !important");
      } else {
        // raw rgb-channel token or other -> keep the definition-level transform
        var outv = transformVarDef(value, theme);
        if (outv !== value) decls.push(prop + ":" + outv + " !important");
      }
      continue;
    }

    var out = transformValue(value, role, theme);
    out = rewriteVars(out, role, colorVars);
    if (out !== value) decls.push(prop + ":" + out + " !important");
  }
  return decls;
}

// First pass: gather the names of every custom property whose value is a color,
// so the emit pass knows which var() usages to rewrite.
export function collectColorVarNames(rules, set) {
  if (!rules) return;
  for (var i = 0; i < rules.length; i++) {
    try {
      var rule = rules[i];
      if (rule.style && rule.selectorText !== undefined) {
        var st = rule.style;
        for (var j = 0; j < st.length; j++) {
          var p = st[j];
          if (p.length > 2 && p[0] === "-" && p[1] === "-") {
            var v = st.getPropertyValue(p);
            if (v && parseColor(v.trim())) set.add(p);
          }
        }
        if (rule.cssRules && rule.cssRules.length) collectColorVarNames(rule.cssRules, set);
      } else if (rule.styleSheet) {
        try { if (rule.styleSheet.cssRules) collectColorVarNames(rule.styleSheet.cssRules, set); } catch (e) {}
      } else if (rule.cssRules) {
        collectColorVarNames(rule.cssRules, set);
      }
    } catch (e) {}
  }
}

function transformStyleRule(rule, theme, colorVars) {
  if (!rule.selectorText) return "";
  var decls = transformDeclaration(rule.style, theme, colorVars);
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
  if (cn === "CSSKeyframesRule") return;

  if (rule.selectorText !== undefined && rule.style) {
    var text = transformStyleRule(rule, theme, ctx.colorVars);
    if (text) ctx.out.push(text);
    if (rule.cssRules && rule.cssRules.length) {
      var sub = { out: [], cors: ctx.cors, colorVars: ctx.colorVars };
      walkRules(rule.cssRules, theme, sub);
      if (sub.out.length) ctx.out.push(rule.selectorText + "{" + sub.out.join("") + "}");
    }
    return;
  }

  if (rule.styleSheet !== undefined && rule.href) {
    var nested = null;
    try { nested = rule.styleSheet && rule.styleSheet.cssRules; } catch (e) { nested = null; }
    if (nested) walkRules(nested, theme, ctx);
    else ctx.cors.push(rule.href);
    return;
  }

  if (rule.cssRules) {
    var sub2 = { out: [], cors: ctx.cors, colorVars: ctx.colorVars };
    walkRules(rule.cssRules, theme, sub2);
    if (!sub2.out.length) return;
    var inner = sub2.out.join("");
    if (cn === "CSSMediaRule" && rule.media) {
      ctx.out.push("@media " + rule.media.mediaText + "{" + inner + "}");
    } else if (cn === "CSSSupportsRule" && rule.conditionText !== undefined) {
      ctx.out.push("@supports " + rule.conditionText + "{" + inner + "}");
    } else {
      ctx.out.push(inner);
    }
    return;
  }
}
