/*
 * Rule-level transform. Walks a CSSOM rule list and emits override CSS text.
 *
 * CSS custom properties (design tokens) are the hard part. For every color
 * token we define THREE role-specific variants and rewrite each var() usage to
 * the one matching the property it appears in — a token used as a background is
 * darkened-as-a-surface, the same token used as text is lightened-as-text.
 *
 * Two extra wrinkles this file handles:
 *   - SHORTHAND var usages (`background: var(--x)`) are stored as a
 *     "pending-substitution value" that getPropertyValue() returns "" for, so
 *     we also scan the rule's cssText to catch them.
 *   - CHAINED tokens (`--a: var(--b)` where --b is a color) are resolved so
 *     chained tokens get variants too (their variants reference the leaf's).
 */
import { transformValue, transformVarDef } from "./values.js";
import { parseColor } from "../color/parse.js";
import { remap } from "../color/remap.js";

var EMPTY = { has: function () { return false; } };

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

function variantName(role, name) { return "--nt-" + role + name; }
function firstVarRef(value) { var m = value && value.match(/var\(\s*(--[A-Za-z0-9_-]+)/); return m ? m[1] : null; }

function rewriteVars(value, role, colorVars) {
  if (!value || value.indexOf("var(") === -1) return value;
  var short = (role === "shadow") ? "bg" : role;
  return value.replace(/var\(\s*(--[A-Za-z0-9_-]+)/g, function (m, name) {
    return colorVars.has(name) ? "var(" + variantName(short, name) : m;
  });
}

// Split a declaration block's cssText into {prop, value} pairs (paren-aware).
function splitDecls(css) {
  var res = [], depth = 0, buf = "";
  for (var i = 0; i < css.length; i++) {
    var ch = css[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === ";" && depth === 0) { res.push(buf); buf = ""; }
    else buf += ch;
  }
  if (buf.trim()) res.push(buf);
  var out = [];
  for (var j = 0; j < res.length; j++) {
    var d = res[j], idx = d.indexOf(":");
    if (idx === -1) continue;
    out.push({ prop: d.slice(0, idx).trim(), value: d.slice(idx + 1).replace(/!important/i, "").trim() });
  }
  return out;
}

export function transformDeclaration(style, theme, colorVars) {
  if (!style) return [];
  colorVars = colorVars || EMPTY;
  var mi = style.getPropertyValue("mask-image") || style.getPropertyValue("-webkit-mask-image");
  var masked = !!mi && mi !== "none";

  var decls = [];
  var emitted = {};
  for (var i = 0; i < style.length; i++) {
    var prop = style[i];
    var role = roleFor(prop, masked);
    if (role === null) continue;
    var value = style.getPropertyValue(prop);
    if (!value) continue;

    if (role === "auto") {
      var val = value.trim();
      var c = parseColor(val);
      if (c) {
        decls.push(variantName("bg", prop) + ":" + remap(c, "bg", theme) + " !important");
        decls.push(variantName("fg", prop) + ":" + remap(c, "fg", theme) + " !important");
        decls.push(variantName("br", prop) + ":" + remap(c, "br", theme) + " !important");
      } else {
        var ref = firstVarRef(val);
        if (ref && colorVars.has(ref)) {
          // chained color token: its variants reference the leaf's variants
          decls.push(variantName("bg", prop) + ":" + rewriteVars(val, "bg", colorVars) + " !important");
          decls.push(variantName("fg", prop) + ":" + rewriteVars(val, "fg", colorVars) + " !important");
          decls.push(variantName("br", prop) + ":" + rewriteVars(val, "br", colorVars) + " !important");
        } else {
          var outv = transformVarDef(value, theme);
          if (outv !== value) decls.push(prop + ":" + outv + " !important");
        }
      }
      continue;
    }

    var out = transformValue(value, role, theme);
    out = rewriteVars(out, role, colorVars);
    if (out !== value) { decls.push(prop + ":" + out + " !important"); emitted[prop] = 1; }
  }

  // Fallback for pending-substitution SHORTHANDS (`background: var(--x)`), which
  // getPropertyValue() can't return — scan cssText and rewrite their var usages.
  var css = style.cssText;
  if (css && css.indexOf("var(") !== -1) {
    var parsed = splitDecls(css);
    for (var k = 0; k < parsed.length; k++) {
      var p2 = parsed[k].prop, v2 = parsed[k].value;
      var r2 = roleFor(p2, masked);
      if (r2 === null || r2 === "auto") continue;
      if (v2.indexOf("var(") === -1) continue;
      if (emitted[p2]) continue; // already handled in the main loop
      var o2 = rewriteVars(transformValue(v2, r2, theme), r2, colorVars);
      if (o2 !== v2) decls.push(p2 + ":" + o2 + " !important");
    }
  }
  return decls;
}

// Record every custom-property definition (name -> value) for chain resolution.
export function collectVarDefs(rules, map) {
  if (!rules) return;
  for (var i = 0; i < rules.length; i++) {
    try {
      var rule = rules[i];
      if (rule.style && rule.selectorText !== undefined) {
        var st = rule.style;
        for (var j = 0; j < st.length; j++) {
          var p = st[j];
          if (p.length > 2 && p[0] === "-" && p[1] === "-") map[p] = st.getPropertyValue(p);
        }
        if (rule.cssRules && rule.cssRules.length) collectVarDefs(rule.cssRules, map);
      } else if (rule.styleSheet) {
        try { if (rule.styleSheet.cssRules) collectVarDefs(rule.styleSheet.cssRules, map); } catch (e) {}
      } else if (rule.cssRules) {
        collectVarDefs(rule.cssRules, map);
      }
    } catch (e) {}
  }
}

// From a name->value map, the set of tokens that are colors — directly (literal
// color value) or transitively (value is var() of another color token).
export function resolveColorVars(map) {
  var set = new Set();
  var name;
  for (name in map) { if (map[name] && parseColor(String(map[name]).trim())) set.add(name); }
  var changed = true;
  while (changed) {
    changed = false;
    for (name in map) {
      if (set.has(name)) continue;
      var ref = firstVarRef(String(map[name] || ""));
      if (ref && set.has(ref)) { set.add(name); changed = true; }
    }
  }
  return set;
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
    try { handleRule(rules[idx], theme, ctx); } catch (e) {}
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
