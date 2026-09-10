/* Notte — popup logic + accessibility panel (tabbed, Figma-matched).
 *
 * ITEMS below is the single source of truth. Each item mirrors the Figma
 * design (label, description, control type, SOON badge).
 *
 * Live controls write per-site settings that content.js reads and applies on
 * BOTH dark and bright pages:
 *   • Header switch   -> extension ON/OFF for this site (overrides).
 *   • Dark Mode       -> the dark-mode feature (dark[host]).
 *   • Every other wired tool -> its own per-site key (contrast/warmth/links/…).
 * A handful of items are still SOON (standalone modules: read-aloud, reading
 * ruler, magnifier, large cursor; and the profile plumbing): shown but inert.
 *
 * Slider values are stored as 0..100 (position along the track). content.js maps
 * each to its real effect and treats the "no-op" end (item.off) as "tool off".
 */
(function () {
  "use strict";

  var api = (typeof browser !== "undefined") ? browser : chrome;

  /* ---------- i18n ----------------------------------------------------------
   * Strings live in _locales/<locale>/messages.json. We read them ourselves
   * rather than calling api.i18n.getMessage(), for two reasons:
   *   1. getMessage() is locked to the browser UI locale with no runtime
   *      override, so a language picker later would mean rewriting every call.
   *      Going through t() keeps that a one-variable change.
   *   2. It lets us fall back to the user's accept-languages when the browser
   *      UI is in a language we do not ship — the common case on a managed
   *      Chromebook set to en-US whose owner reads another language.
   * Every lookup falls back to the English baked into ITEMS/popup.html, so a
   * failed fetch degrades to English rather than to empty labels.
   * -------------------------------------------------------------------- */
  // Clock icon for tools that are not built yet — exported from Figma (139:72).
  var CLOCK_SVG = '<svg width="16" height="17" viewBox="0 0 16 17" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M15.8183 6.34097C15.6997 5.79367 15.486 5.18512 15.2893 4.65476C15.0482 4.29771 14.5895 4.06966 14.2155 4.23254C13.8415 4.39542 13.6747 4.75898 13.7594 5.14991C13.7764 5.2281 13.7764 5.2281 13.7933 5.30629C13.9731 5.75846 14.153 6.21064 14.2546 6.67976C14.9999 10.1199 12.795 13.5445 9.35485 14.2898C5.91467 15.0351 2.49015 12.8302 1.74483 9.39004C0.999499 5.94985 3.20438 2.52534 6.64457 1.78001C7.11369 1.67838 7.59974 1.65493 8.0858 1.63148C8.49367 1.62497 8.83378 1.30571 8.88852 0.802719C8.88201 0.394849 8.48457 0.0716758 8.05976 0C7.49552 0.0403887 6.85309 0.0977167 6.30579 0.216291C2.00555 1.14795 -0.750554 5.42859 0.181105 9.72882C1.11276 14.0291 5.3934 16.7852 9.69364 15.8535C13.9939 14.9218 16.75 10.6412 15.8183 6.34097Z" fill="#A09BDD"/><path d="M9.95085 1.55376C10.0017 1.78832 10.2089 1.989 10.3991 2.1115C11.1262 2.4451 11.7921 2.87383 12.3967 3.39768C12.716 3.73779 13.2021 3.71434 13.5422 3.39509C13.8823 3.07583 13.8419 2.51159 13.5396 2.24966C12.8229 1.58638 11.9668 1.03516 11.0663 0.657247C10.6076 0.429199 10.1555 0.609021 9.9274 1.06771C9.88309 1.24102 9.91697 1.39739 9.95085 1.55376Z" fill="#A09BDD"/><path d="M7.99922 3.51758C7.51922 3.51758 7.19922 3.83758 7.19922 4.31758V7.51758C7.19922 7.75758 7.27922 7.91758 7.43922 8.07758L9.83922 10.4776C9.99922 10.6376 10.2392 10.7176 10.3992 10.7176C10.5592 10.7176 10.7992 10.6376 10.9592 10.4776C11.2792 10.1576 11.2792 9.67758 10.9592 9.35758L8.79922 7.19758V4.31758C8.79922 3.83758 8.47922 3.51758 7.99922 3.51758Z" fill="#A09BDD"/></svg>';

  var MSG = {};

  function readLocale(loc) {
    return fetch(api.runtime.getURL("_locales/" + loc + "/messages.json"))
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (j) {
        if (!j) return null;
        var out = {};
        Object.keys(j).forEach(function (k) { out[k] = j[k].message; });
        return out;
      })
      .catch(function () { return null; });
  }

  function candidates(tag) {
    var t = String(tag || "").replace("-", "_");
    var out = [];
    if (t) out.push(t);
    if (t.indexOf("_") > -1) out.push(t.split("_")[0]);
    return out;
  }

  function loadMessages() {
    var ui = "";
    try { ui = api.i18n && api.i18n.getUILanguage ? api.i18n.getUILanguage() : navigator.language; } catch (_) {}

    // Test hook. Opening popup.html?lang=de in a normal tab shows the popup in
    // that language, so all six locales can be checked in one browser without
    // restarting it or making a second profile. Users never see this: the
    // browser opens the popup with no query string, so `forced` stays empty.
    var forced = "";
    try { forced = new URLSearchParams(location.search).get("lang") || ""; } catch (_) {}

    return readLocale("en").then(function (base) {
      MSG = base || {};
      // When a language is forced we do NOT fall back to accept-languages —
      // a test should show that language or plain English, nothing else.
      return forced ? overlay(candidates(forced), true) : overlay(candidates(ui));
    }).catch(function () { return null; });
  }

  function overlay(list, strict) {
    if (!list.length) return strict ? null : acceptLangFallback();
    var loc = list.shift();
    if (loc === "en") return null;                 // base is already English
    return readLocale(loc).then(function (found) {
      if (!found) return overlay(list, strict);
      Object.keys(found).forEach(function (k) { MSG[k] = found[k]; });
      return true;
    });
  }

  // Browser UI language had no locale of ours. The user's preferred languages
  // often still do — a school Chromebook is en-US, its reader may not be.
  function acceptLangFallback() {
    if (!api.i18n || !api.i18n.getAcceptLanguages) return null;
    return new Promise(function (resolve) {
      try {
        api.i18n.getAcceptLanguages(function (langs) {
          var queue = [];
          (langs || []).forEach(function (l) { candidates(l).forEach(function (c) { queue.push(c); }); });
          resolve(overlay(queue));
        });
      } catch (_) { resolve(null); }
    });
  }

  function t(key, fallback) {
    var v = MSG[key];
    return (v === undefined || v === null || v === "") ? (fallback !== undefined ? fallback : key) : v;
  }

  function applyStaticText() {
    document.querySelectorAll("[data-i18n]").forEach(function (n) {
      n.textContent = t(n.getAttribute("data-i18n"), n.textContent);
    });
    document.querySelectorAll("[data-i18n-aria]").forEach(function (n) {
      n.setAttribute("aria-label", t(n.getAttribute("data-i18n-aria"), n.getAttribute("aria-label")));
    });
  }

  // Focus rings show only while navigating by keyboard: ONLY the navigation keys
  // turn it on, and any pointer interaction turns it off. (Safari otherwise
  // renders :focus-visible on click and on the popup's initial focus.)
  window.addEventListener("keydown", function (e) {
    if (e && (e.key === "Tab" || (e.key && e.key.indexOf("Arrow") === 0))) {
      try { document.body.classList.add("kbd"); } catch (_) {}
    }
  }, true);
  var _clearKbd = function () { try { document.body.classList.remove("kbd"); } catch (_) {} };
  window.addEventListener("mousedown", _clearKbd, true);
  window.addEventListener("pointerdown", _clearKbd, true);
  window.addEventListener("touchstart", _clearKbd, true);
  var KEYS = ["overrides", "dark", "contrast", "warmth", "links", "motion", "focus",
    "brightness", "saturation", "dimimg", "textsize", "letter", "paragraph", "font"];
  var DEFAULTS = {};
  KEYS.forEach(function (k) { DEFAULTS[k] = {}; });

  // place: "bottom" renders the control full-width beneath the label (like sliders).
  // key   : storage key. off: the slider value that means "tool off".
  var ITEMS = {
    vision: [
      { id: "dark",       name: "Dark mode",       desc: "Darken this site",                         type: "toggle", live: true },
      { id: "warmth",     name: "Warm tint",       desc: "Cut blue light",                            type: "toggle", live: true, key: "warmth" },
      { id: "links",      name: "Emphasise links", desc: "Underline every link",                      type: "toggle", live: true, key: "links" },
      { id: "motion",     name: "Reduce motion",   desc: "Stop animations and autoplay",             type: "toggle", live: true, key: "motion" },
      { id: "focus",      name: "Strong focus",    desc: "Make keyboard focus obvious",              type: "toggle", live: true, key: "focus" },
      { id: "contrast",   name: "Contrast",        desc: "Boost text contrast (AAA)",                type: "value",  live: true, val: "OFF", w: 95 },
      { divider: true },
      { id: "brightness", name: "Brightness",      desc: "Dim bright pages",                         type: "slider", live: true, key: "brightness", off: 100 },
      { id: "saturation", name: "Saturation",      desc: "Mute colours, or go fully grey",           type: "slider", live: true, key: "saturation", off: 100 },
      { id: "dimimg",     name: "Dim images",      desc: "Soften bright or busy images",             type: "slider", live: true, key: "dimimg", off: 100 }
    ],
    reading: [
      { id: "font",       name: "Dyslexia font",     desc: "Clearer, dyslexia-friendly",            type: "toggle", live: true },
      { id: "readaloud",  name: "Read aloud",        desc: "Hear any page read aloud",              type: "toggle", pill: true },
      { id: "ruler",      name: "Reading ruler",     desc: "Highlight the line you're on",          type: "toggle", pill: true },
      { id: "magnifier",  name: "Magnifier",         desc: "Cursor-following lens (hold Alt)",      type: "toggle", pill: true },
      { id: "cursor",     name: "Large cursor",      desc: "Bigger, easier-to-see pointer",         type: "toggle", pill: true },
      { divider: true },
      { id: "textsize",   name: "Text size",         desc: "Enlarge text on any site",              type: "slider", live: true, key: "textsize", off: 0 },
      { id: "letter",     name: "Letter spacing",    desc: "Space out letters and words",           type: "slider", live: true, key: "letter", off: 0 },
      { id: "paragraph",  name: "Line spacing",      desc: "Add space between lines",               type: "slider", live: true, key: "paragraph", off: 0 }
    ],
    profile: [
      { id: "preset",     name: "Preset",    desc: "One-click readability",          type: "obtn", btn: "Apply", pill: true },
      { id: "shortcuts",  name: "Shortcuts", desc: "Every toggle from the keyboard", type: "obtn", btn: "Set",   pill: true }
    ]
  };

  var host = "", settings = null, currentTab = "vision", activeTabId = null;

  var el = {
    host: document.getElementById("host"),
    panel: document.getElementById("panel"),
    profilePanel: document.getElementById("profilePanel"),
    mainView: document.getElementById("mainView"),
    profileView: document.getElementById("profileView"),
    tabVision: document.getElementById("tab-vision"),
    tabReading: document.getElementById("tab-reading"),
    master: document.getElementById("masterToggle")
  };

  /* ---------- storage / tab helpers ---------- */
  function getSettings() {
    return new Promise(function (resolve) {
      try {
        var p = api.storage.local.get(DEFAULTS);
        if (p && typeof p.then === "function") p.then(resolve).catch(function () { resolve(DEFAULTS); });
        else api.storage.local.get(DEFAULTS, resolve);
      } catch (e) { resolve(DEFAULTS); }
    });
  }
  function save() {
    try { api.storage.local.set(settings); } catch (e) {}
    if (activeTabId != null) {
      try {
        var r = api.tabs.sendMessage(activeTabId, { type: "notte-apply" });
        if (r && typeof r.then === "function") r.catch(function () {});
      } catch (e) {}
    }
  }
  function getActiveHost() {
    return new Promise(function (resolve) {
      try {
        var p = api.tabs.query({ active: true, currentWindow: true });
        var handle = function (tabs) {
          if (tabs && tabs[0]) activeTabId = tabs[0].id;
          var url = (tabs && tabs[0] && tabs[0].url) || "";
          try { resolve(new URL(url).hostname || ""); } catch (e) { resolve(""); }
        };
        if (p && typeof p.then === "function") p.then(handle).catch(function () { resolve(""); });
        else api.tabs.query({ active: true, currentWindow: true }, handle);
      } catch (e) { resolve(""); }
    });
  }

  /* ---------- control builders ---------- */
  function toggleEl(item) {
    var live = !!item.live;
    var b = document.createElement(live ? "button" : "span");
    b.className = "sw" + (live ? " live" : " deact");
    if (live) b.setAttribute("role", "switch");
    b.innerHTML = '<span class="knob"></span>';
    return b;
  }
  function valueEl(item) {
    var live = !!item.live;
    var d = document.createElement("div");
    d.className = "val" + (live ? "" : " deact") + (item.place === "bottom" ? " full" : "");
    if (item.place !== "bottom") d.style.width = item.w + "px";
    var k = document.createElement("span");
    k.className = "knob";
    k.textContent = t("val_" + String(item.val).toLowerCase(), item.val);
    d.appendChild(k);
    return d;
  }
  function sliderEl(item) {
    var live = !!item.live;
    var off = item.off || 0;
    var d = document.createElement("div");
    d.className = "slider" + (live ? "" : " deact");
    d.innerHTML = '<div class="rail"></div><div class="knob" style="left:calc(' + off + '% - ' + ((off / 100) * 45).toFixed(1) + 'px)"></div>';
    return d;
  }
  function obtnEl(item) {
    var s = document.createElement("span");
    s.className = "obtn deact";
    s.textContent = t("btn_" + String(item.btn).toLowerCase(), item.btn);
    return s;
  }
  function contrastSwitchEl() {
    var b = document.createElement("button");
    b.className = "sw live";
    b.setAttribute("role", "switch");
    var k = document.createElement("span");
    k.className = "knob";
    b.appendChild(k);
    return b;
  }
  function controlEl(item) {
    if (item.id === "contrast") return contrastSwitchEl(item);
    if (item.type === "toggle") return toggleEl(item);
    if (item.type === "value")  return valueEl(item);
    if (item.type === "slider") return sliderEl(item);
    return obtnEl(item);
  }
  function isStacked(item) {
    return item.type === "slider" || (item.type === "value" && item.place === "bottom");
  }

  /* ---------- render a list of items ---------- */
  function renderList(container, items) {
    container.textContent = "";
    var frag = document.createDocumentFragment();
    items.forEach(function (it) {
      if (it.divider) {
        var dv = document.createElement("div");
        dv.className = "divider";
        frag.appendChild(dv);
        return;
      }
      var row = document.createElement("div");
      row.className = "item " + (isStacked(it) ? "stacked" : "inline") + (it.pill ? " pending" : "");

      var lb = document.createElement("div"); lb.className = "labelblock";
      var ll = document.createElement("div"); ll.className = "labelline";
      var nm = document.createElement("div"); nm.className = "name"; nm.textContent = t(it.id, it.name);

      if (it.pill) {
        // Tools that are not built yet (Figma 139:66): the NAME itself sits in a
        // chip with a clock icon, instead of a separate "SOON" badge beside it.
        // There is no badge word on screen, so nothing here can overflow when
        // translated — the old pill capped how long a tool name could be, and
        // Italian "Righello di lettura" + "IN ARRIVO" broke the 360px popup.
        // The wording survives as a screen-reader-only label, so a blind user
        // still hears that the tool is not available yet, in their language.
        var chip = document.createElement("span");
        chip.className = "soonchip";
        chip.innerHTML = CLOCK_SVG;          // static markup, no user input
        chip.appendChild(nm);
        var sr = document.createElement("span");
        sr.className = "sr-only";
        sr.textContent = t("pill_soon", "Coming soon");
        chip.appendChild(sr);
        ll.appendChild(chip);
      } else {
        ll.appendChild(nm);
      }

      var ds = document.createElement("div"); ds.className = "desc"; ds.textContent = t(it.id + "_desc", it.desc);
      lb.appendChild(ll); lb.appendChild(ds);
      row.appendChild(lb);

      var ctrl = controlEl(it);
      if (it.id === "dark") ctrl.id = "darkToggle";
      else if (it.id) ctrl.id = it.id + "Ctrl";
      row.appendChild(ctrl);
      frag.appendChild(row);
    });
    container.appendChild(frag);
  }

  /* ---------- live state: extension on/off + dark-mode feature ---------- */
  function extOn()  { return !settings ? true : settings.overrides[host] !== false; }
  function darkOn() { return !settings ? true : settings.dark[host] !== false; }
  function paint(node, on) {
    if (!node) return;
    node.classList.toggle("on", on);
    if (node.hasAttribute("role")) node.setAttribute("aria-checked", String(on));
  }
  function setExt(on)  { if (settings) { settings.overrides[host] = on; save(); paint(el.master, on); } }
  function setDark(on) { if (settings) { settings.dark[host] = on; save(); paint(document.getElementById("darkToggle"), on); } }

  function wireDarkRow() {
    var t = document.getElementById("darkToggle");
    if (t && !t._wired) {
      t._wired = true;
      t.classList.add("live");
      t.style.cursor = "pointer";
      t.addEventListener("click", function () { setDark(!darkOn()); });
      t.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); setDark(!darkOn()); }
      });
    }
    paint(t, darkOn());
  }

  /* ---------- generic toggles (warm tint, links, motion, focus) ---------- */
  function toggleOn(it) { return !!(settings && settings[it.key] && settings[it.key][host] === true); }
  function setToggle(it, on) {
    if (!settings) return;
    if (!settings[it.key]) settings[it.key] = {};
    settings[it.key][host] = on;
    save();
    paintToggle(it);
  }
  function paintToggle(it) { paint(document.getElementById(it.id + "Ctrl"), toggleOn(it)); }
  function wireToggle(it) {
    var t = document.getElementById(it.id + "Ctrl");
    if (t && !t._wired) {
      t._wired = true;
      t.classList.add("live");
      t.style.cursor = "pointer";
      t.addEventListener("click", function () { setToggle(it, !toggleOn(it)); });
      t.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); setToggle(it, !toggleOn(it)); }
      });
    }
    paintToggle(it);
  }

  /* ---------- sliders (brightness, saturation, dim images, text size, spacing) ---------- */
  function sliderVal(it) {
    var v = settings && settings[it.key] && settings[it.key][host];
    return typeof v === "number" ? v : (it.off || 0);
  }
  function paintSlider(it) {
    var c = document.getElementById(it.id + "Ctrl");
    if (!c) return;
    var k = c.querySelector(".knob");
    if (!k) return;
    var pct = Math.max(0, Math.min(100, sliderVal(it)));
    k.style.left = "calc(" + pct + "% - " + ((pct / 100) * 45).toFixed(1) + "px)";
    c.setAttribute("role", "slider");
    c.setAttribute("aria-valuemin", "0");
    c.setAttribute("aria-valuemax", "100");
    c.setAttribute("aria-valuenow", String(Math.round(pct)));
    c.setAttribute("aria-label", it.name);
  }
  function setSlider(it, pct) {
    pct = Math.max(0, Math.min(100, Math.round(pct)));
    if (!settings) return;
    if (!settings[it.key]) settings[it.key] = {};
    settings[it.key][host] = pct;
    save();
    paintSlider(it);
  }
  function wireSlider(it) {
    var c = document.getElementById(it.id + "Ctrl");
    if (c && !c._wired) {
      c._wired = true;
      c.tabIndex = 0;
      c.style.cursor = "pointer";
      var dragging = false;
      var fromX = function (x) {
        var r = c.getBoundingClientRect();
        return r.width ? (x - r.left) / r.width * 100 : 0;
      };
      c.addEventListener("pointerdown", function (e) {
        dragging = true;
        try { c.setPointerCapture(e.pointerId); } catch (_) {}
        setSlider(it, fromX(e.clientX));
      });
      c.addEventListener("pointermove", function (e) { if (dragging) setSlider(it, fromX(e.clientX)); });
      c.addEventListener("pointerup", function () { dragging = false; });
      c.addEventListener("pointercancel", function () { dragging = false; });
      c.addEventListener("keydown", function (e) {
        var v = sliderVal(it);
        if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); setSlider(it, v + 5); }
        else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); setSlider(it, v - 5); }
      });
    }
    paintSlider(it);
  }

  /* ---------- contrast (per-site, OFF <-> AAA) — first live v3 tool ---------- */
  function contrastState() { return (settings && settings.contrast && settings.contrast[host]) || "off"; }
  function paintContrast() {
    var c = document.getElementById("contrastCtrl");
    if (!c) return;
    var on = contrastState() !== "off";
    c.classList.toggle("on", on);   // shared .sw.on CSS slides + recolours the knob
    c.setAttribute("aria-label", on ? t("aria_contrast_aaa", "Contrast: AAA") : t("aria_contrast_off", "Contrast: off"));
    c.setAttribute("aria-checked", String(on));
  }
  function setContrast(next) {
    if (!settings) return;
    if (!settings.contrast) settings.contrast = {};
    settings.contrast[host] = next;
    save();
    paintContrast();
  }
  function wireContrastRow() {
    var c = document.getElementById("contrastCtrl");
    if (c && !c._wired) {
      c._wired = true;
      c.tabIndex = 0;
      var cycle = function () { setContrast(contrastState() === "off" ? "aaa" : "off"); };
      c.addEventListener("click", cycle);
      c.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); cycle(); }
      });
    }
    paintContrast();
  }

  /* ---------- font (per-site, OFF <-> Dyslexic) ---------- */
  function fontState() { return (settings && settings.font && settings.font[host]) || "off"; }
  function paintFont() {
    var c = document.getElementById("fontCtrl");
    if (!c) return;
    var on = fontState() !== "off";
    c.classList.toggle("on", on);
    c.setAttribute("aria-label", "Dyslexia font: " + (on ? "on" : "off"));
    c.setAttribute("aria-checked", String(on));
  }
  function setFont(v) {
    if (!settings) return;
    if (!settings.font) settings.font = {};
    settings.font[host] = v;
    save();
    paintFont();
  }
  function wireFont() {
    var c = document.getElementById("fontCtrl");
    if (c && !c._wired) {
      c._wired = true;
      c.classList.add("live");
      c.style.cursor = "pointer";
      var flip = function () { setFont(fontState() === "off" ? "dyslexic" : "off"); };
      c.addEventListener("click", flip);
      c.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); }
      });
    }
    paintFont();
  }

  /* ---------- wire + paint the current tab ---------- */
  function wireRow(it) {
    if (!it.id || !it.live) return;
    if (it.id === "dark") return wireDarkRow();
    if (it.id === "contrast") return wireContrastRow();
    if (it.id === "font") return wireFont();
    if (it.type === "toggle") return wireToggle(it);
    if (it.type === "slider") return wireSlider(it);
  }
  function syncLive() {
    paint(el.master, extOn());
    (ITEMS[currentTab] || []).forEach(function (it) {
      if (!it.id || !it.live) return;
      if (it.id === "dark") paint(document.getElementById("darkToggle"), darkOn());
      else if (it.id === "contrast") paintContrast();
      else if (it.id === "font") paintFont();
      else if (it.type === "toggle") paintToggle(it);
      else if (it.type === "slider") paintSlider(it);
    });
  }

  el.master.addEventListener("click", function () { setExt(!extOn()); });
  el.master.addEventListener("keydown", function (e) {
    if (e.key === " " || e.key === "Enter") { e.preventDefault(); setExt(!extOn()); }
  });

  /* ---------- tabs ---------- */
  function selectTab(tab) {
    currentTab = tab;
    var onVision = (tab === "vision");
    el.tabVision.setAttribute("aria-selected", String(onVision));
    el.tabReading.setAttribute("aria-selected", String(!onVision));
    el.tabVision.tabIndex = onVision ? 0 : -1;
    el.tabReading.tabIndex = onVision ? -1 : 0;
    el.panel.setAttribute("aria-labelledby", onVision ? "tab-vision" : "tab-reading");
    renderList(el.panel, ITEMS[tab]);
    (ITEMS[tab] || []).forEach(wireRow);
    syncLive();
    el.panel.scrollTop = 0;
  }
  el.tabVision.addEventListener("click", function () { selectTab("vision"); });
  el.tabReading.addEventListener("click", function () { selectTab("reading"); });
  [el.tabVision, el.tabReading].forEach(function (tabEl) {
    tabEl.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        var next = (currentTab === "vision") ? "reading" : "vision";
        selectTab(next);
        (next === "vision" ? el.tabVision : el.tabReading).focus();
      }
    });
  });

  /* ---------- profile view ---------- */
  function showProfile() {
    renderList(el.profilePanel, ITEMS.profile);
    el.mainView.hidden = true;
    el.profileView.hidden = false;
    document.getElementById("backBtn").focus();
  }
  function hideProfile() {
    el.profileView.hidden = true;
    el.mainView.hidden = false;
    document.getElementById("openProfile").focus();
  }
  document.getElementById("openProfile").addEventListener("click", showProfile);
  document.getElementById("backBtn").addEventListener("click", hideProfile);

  /* ---------- start ---------- */
  loadMessages().then(function () {
    applyStaticText();
    selectTab("vision");
    return Promise.all([getSettings(), getActiveHost()]);
  }).then(function (res) {
    settings = res[0] || DEFAULTS;
    KEYS.forEach(function (k) { if (!settings[k]) settings[k] = {}; });
    host = res[1] || "";
    el.host.textContent = host || t("ui_this_page", "this page");
    selectTab(currentTab);
  });
})();
