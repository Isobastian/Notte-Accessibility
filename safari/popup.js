/* Notte — popup logic + accessibility panel (tabbed, Figma-matched).
 *
 * ITEMS below is the single source of truth. Each item mirrors the Figma
 * design (label, description, control type, SOON badge).
 *
 * Two independent live controls today:
 *   • Header switch  -> turns the extension ON/OFF for this site (overrides).
 *   • "Dark Mode" row -> the dark-mode feature toggle (its own setting).
 * Every other item is SOON: shown but deactivated (off + inert).
 */
(function () {
  "use strict";

  var api = (typeof browser !== "undefined") ? browser : chrome;
  var DEFAULTS = { overrides: {}, dark: {}, contrast: {} };

  // place: "bottom" renders the control full-width beneath the label (like sliders).
  var ITEMS = {
    vision: [
      { id: "dark",       name: "Dark Mode",       desc: "Darken this site",                         type: "toggle", live: true },
      { id: "warmth",     name: "Warm tint",       desc: "Cut blue light",                           type: "toggle", pill: true },
      { id: "links",      name: "Emphasize links", desc: "Underline every link",                     type: "toggle", pill: true },
      { id: "motion",     name: "Reduce motion",   desc: "Stop animations and autoplay",             type: "toggle", pill: true },
      { id: "contrast",   name: "Contrast",        desc: "Boost text contrast (AA / AAA)",           type: "value",  val: "OFF", w: 95 },
      { divider: true },
      { id: "brightness", name: "Brightness",      desc: "Dim bright pages",                         type: "slider", pct: 62, pill: true },
      { id: "saturation", name: "Saturation",      desc: "Mute colours, or go fully grey",           type: "slider", pct: 54, pill: true },
      { id: "focus",      name: "Strong focus",    desc: "Make keyboard focus obvious",              type: "toggle", pill: true },
      { id: "dimimg",     name: "Dim images",      desc: "Soften bright or busy images",             type: "slider", pct: 45, pill: true }
    ],
    reading: [
      { id: "readaloud",  name: "Read aloud",        desc: "Hear any page read aloud",              type: "toggle", pill: true },
      { id: "ruler",      name: "Reading ruler",     desc: "Highlight the line you're on",          type: "toggle", pill: true },
      { divider: true },
      { id: "textsize",   name: "Text size",         desc: "Enlarge text on any site",              type: "slider", pct: 62, pill: true },
      { id: "letter",     name: "Letter spacing",    desc: "Space out letters and words",           type: "slider", pct: 50, pill: true },
      { id: "paragraph",  name: "Paragraph spacing", desc: "Add space between lines",               type: "slider", pct: 55, pill: true },
      { id: "font",       name: "Font",              desc: "Clearer, dyslexia-friendly fonts",      type: "value", val: "Dyslexic", place: "bottom", pill: true },
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
    var d = document.createElement("div");
    d.className = "val deact" + (item.place === "bottom" ? " full" : "");
    if (item.place !== "bottom") d.style.width = item.w + "px";
    var k = document.createElement("span");
    k.className = "knob";
    k.textContent = item.val;
    d.appendChild(k);
    return d;
  }
  function sliderEl(item) {
    var d = document.createElement("div");
    d.className = "slider deact";
    d.innerHTML = '<div class="rail"></div><div class="knob" style="left:calc(' + item.pct + '% - 22px)"></div>';
    return d;
  }
  function obtnEl(item) {
    var s = document.createElement("span");
    s.className = "obtn deact";
    s.textContent = item.btn;
    return s;
  }
  // Contrast is a 3-stop sliding switch (OFF left / AA middle / AAA right),
  // built to match the on/off switches: same purple track, a knob that slides
  // and is dark when OFF, light when active.
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
      if (it.id === "contrast") ctrl.id = "contrastCtrl";
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
  function syncLive() {
    paint(el.master, extOn());
    paint(document.getElementById("darkToggle"), darkOn());
    paintContrast();
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
    }
  }
  /* ---------- contrast (per-site, OFF -> AA -> AAA) — first live v3 tool ---------- */
  function contrastState() { return (settings && settings.contrast && settings.contrast[host]) || "off"; }
  function contrastLabel(s) { return s === "aaa" ? "AAA" : (s === "aa" ? "AA" : "OFF"); }
  function paintContrast() {
    var c = document.getElementById("contrastCtrl");
    if (!c) return;
    var k = c.querySelector(".knob");
    if (!k) return;
    var s = contrastState();
    // 3 stops in a 92px track (knob 41px): OFF left, AA middle, AAA right.
    k.style.left = s === "aaa" ? "49px" : (s === "aa" ? "25px" : "2px");
    k.style.background = s === "off" ? C_DARK_KNOB : C_LIGHT_KNOB;
    k.textContent = s === "off" ? "" : (s === "aa" ? "AA" : "AAA");
    c.setAttribute("aria-label", "Contrast: " + (s === "off" ? "off" : s.toUpperCase()));
    c.setAttribute("aria-checked", String(s !== "off"));
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
      var cycle = function () {
        var s = contrastState();
        setContrast(s === "off" ? "aa" : (s === "aa" ? "aaa" : "off"));
      };
      c.addEventListener("click", cycle);
      c.addEventListener("keydown", function (e) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); cycle(); }
      });
    }
    paintContrast();
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
    if (onVision) { wireDarkRow(); wireContrastRow(); syncLive(); }
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
    if (!settings.overrides) settings.overrides = {};
    if (!settings.dark) settings.dark = {};
    if (!settings.contrast) settings.contrast = {};
    host = res[1] || "";
    el.host.textContent = host || "this page";
    syncLive();
  });
})();
