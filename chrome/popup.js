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
  var KEYS = ["overrides", "dark", "contrast", "warmth", "links", "motion", "focus",
    "brightness", "saturation", "dimimg", "textsize", "letter", "paragraph", "font"];
  var DEFAULTS = {};
  KEYS.forEach(function (k) { DEFAULTS[k] = {}; });

  // place: "bottom" renders the control full-width beneath the label (like sliders).
  // key   : storage key. off: the slider value that means "tool off".
  var ITEMS = {
    vision: [
      { id: "dark",       name: "Dark Mode",       desc: "Darken this site",                         type: "toggle", live: true },
      { id: "warmth",     name: "Warm tint",       desc: "Cut blue light",                            type: "toggle", live: true, key: "warmth" },
      { id: "links",      name: "Emphasize links", desc: "Underline every link",                      type: "toggle", live: true, key: "links" },
      { id: "motion",     name: "Reduce motion",   desc: "Stop animations and autoplay",             type: "toggle", live: true, key: "motion" },
      { id: "contrast",   name: "Contrast",        desc: "Boost text contrast (AAA)",                type: "value",  live: true, val: "OFF", w: 95 },
      { divider: true },
      { id: "brightness", name: "Brightness",      desc: "Dim bright pages",                         type: "slider", live: true, key: "brightness", off: 100 },
      { id: "saturation", name: "Saturation",      desc: "Mute colours, or go fully grey",           type: "slider", live: true, key: "saturation", off: 100 },
      { id: "focus",      name: "Strong focus",    desc: "Make keyboard focus obvious",              type: "toggle", live: true, key: "focus" },
      { id: "dimimg",     name: "Dim images",      desc: "Soften bright or busy images",             type: "slider", live: true, key: "dimimg", off: 100 }
    ],
    reading: [
      { id: "readaloud",  name: "Read aloud",        desc: "Hear any page read aloud",              type: "toggle", pill: true },
      { id: "ruler",      name: "Reading ruler",     desc: "Highlight the line you're on",          type: "toggle", pill: true },
      { divider: true },
      { id: "textsize",   name: "Text size",         desc: "Enlarge text on any site",              type: "slider", live: true, key: "textsize", off: 0 },
      { id: "letter",     name: "Letter spacing",    desc: "Space out letters and words",           type: "slider", live: true, key: "letter", off: 0 },
      { id: "paragraph",  name: "Paragraph spacing", desc: "Add space between lines",               type: "slider", live: true, key: "paragraph", off: 0 },
      { id: "font",       name: "Font",              desc: "Clearer, dyslexia-friendly fonts",      type: "value", live: true, val: "Dyslexic", place: "bottom" },
      { id: "magnifier",  name: "Magnifier",         desc: "Cursor-following lens (hold Alt)",      type: "toggle", pill: true },
      { id: "cursor",     name: "Large cursor",      desc: "Bigger, easier-to-see pointer",         type: "toggle", pill: true }
    ],
    profile: [
      { id: "remember",   name: "Remember",  desc: "Save each site's settings",      type: "toggle", pill: true },
      { id: "preset",     name: "Preset",    desc: "One-click readability",          type: "obtn", btn: "Apply", pill: true },
      { id: "shortcuts",  name: "Shortcuts", desc: "Every toggle from the keyboard", type: "obtn", btn: "Set",   pill: true }
    ]
  };

  var host = "", settings = null, currentTab = "vision";

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
  function save() { try { api.storage.local.set(settings); } catch (e) {} }
  function getActiveHost() {
    return new Promise(function (resolve) {
      try {
        var p = api.tabs.query({ active: true, currentWindow: true });
        var handle = function (tabs) {
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
    k.textContent = item.val;
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
    s.textContent = item.btn;
    return s;
  }
  // Contrast is a two-stop sliding switch (OFF left / AAA right), built to match
  // the on/off switches: same purple track, a knob that slides and is dark when
  // OFF, light when active.
  var C_DARK_KNOB = "radial-gradient(circle at 60% 38%,#332c66 0%,#16123a 48%,#0b0822 100%)";
  var C_LIGHT_KNOB = "radial-gradient(circle at 68% 30%,#fff 0%,#cecbfb 48%,#9d97f6 100%)";
  function contrastSwitchEl() {
    var b = document.createElement("button");
    b.className = "sw live";
    b.setAttribute("role", "button");
    b.style.width = "92px";
    var k = document.createElement("span");
    k.className = "knob";
    k.style.cssText = "display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:#251e8b;";
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
      row.className = "item " + (isStacked(it) ? "stacked" : "inline");

      var lb = document.createElement("div"); lb.className = "labelblock";
      var ll = document.createElement("div"); ll.className = "labelline";
      var nm = document.createElement("div"); nm.className = "name"; nm.textContent = it.name;
      ll.appendChild(nm);
      if (it.pill) {
        var p = document.createElement("span"); p.className = "pill"; p.textContent = "SOON";
        ll.appendChild(p);
      }
      var ds = document.createElement("div"); ds.className = "desc"; ds.textContent = it.desc;
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
    var k = c.querySelector(".knob");
    if (!k) return;
    var on = contrastState() !== "off";
    // Two stops in the 92px track (knob 41px): OFF left, AAA right.
    k.style.left = on ? "49px" : "2px";
    k.style.background = on ? C_LIGHT_KNOB : C_DARK_KNOB;
    k.textContent = on ? "AAA" : "";
    c.setAttribute("aria-label", "Contrast: " + (on ? "AAA" : "off"));
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
    var k = c.querySelector(".knob");
    if (!k) return;
    var on = fontState() !== "off";
    k.textContent = on ? "Dyslexic" : "OFF";
    c.classList.toggle("on", on);
    c.setAttribute("aria-label", "Font: " + (on ? "dyslexia-friendly" : "site default"));
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
      c.tabIndex = 0;
      c.style.cursor = "pointer";
      c.classList.remove("deact");
      c.setAttribute("role", "button");
      var cycle = function () { setFont(fontState() === "off" ? "dyslexic" : "off"); };
      c.addEventListener("click", cycle);
      c.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); cycle(); }
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
  selectTab("vision");
  Promise.all([getSettings(), getActiveHost()]).then(function (res) {
    settings = res[0] || DEFAULTS;
    KEYS.forEach(function (k) { if (!settings[k]) settings[k] = {}; });
    host = res[1] || "";
    el.host.textContent = host || "this page";
    selectTab(currentTab);
  });
})();
