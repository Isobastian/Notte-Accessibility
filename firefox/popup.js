/* Notte - Dark Mode - popup logic */
(function () {
  "use strict";

  var api = (typeof browser !== "undefined") ? browser : chrome;

  // enabled/autoSkipDark/keepImages/brightness/contrast are no longer
  // configurable from the popup: new sites always start dark, sites that are
  // already dark are always detected and left alone, images always stay in
  // their natural colors (see content.js). The only thing left is the
  // per-site switch (`overrides`).
  var DEFAULTS = { overrides: {} };

  var host = "";
  var settings = null;

  var el = {
    host: document.getElementById("host"),
    siteToggle: document.getElementById("siteToggle"),
    siteDesc: document.getElementById("siteDesc")
  };

  function getSettings() {
    return new Promise(function (resolve) {
      try {
        var p = api.storage.local.get(DEFAULTS);
        if (p && typeof p.then === "function") {
          p.then(resolve).catch(function () { resolve(DEFAULTS); });
        } else {
          api.storage.local.get(DEFAULTS, resolve);
        }
      } catch (e) { resolve(DEFAULTS); }
    });
  }

  function save() {
    try { api.storage.local.set(settings); } catch (e) {}
  }

  function getActiveHost() {
    return new Promise(function (resolve) {
      try {
        var p = api.tabs.query({ active: true, currentWindow: true });
        var handle = function (tabs) {
          var url = (tabs && tabs[0] && tabs[0].url) || "";
          try { resolve(new URL(url).hostname || ""); }
          catch (e) { resolve(""); }
        };
        if (p && typeof p.then === "function") p.then(handle).catch(function () { resolve(""); });
        else api.tabs.query({ active: true, currentWindow: true }, handle);
      } catch (e) { resolve(""); }
    });
  }

  function siteEnabled() {
    if (Object.prototype.hasOwnProperty.call(settings.overrides, host)) {
      return settings.overrides[host];
    }
    return true; // new sites always start dark
  }

  function refresh() {
    el.host.textContent = host || "this page";
    el.siteToggle.checked = siteEnabled();
    el.siteDesc.textContent = siteEnabled() ? "On" : "Off";
  }

  el.siteToggle.addEventListener("change", function () {
    settings.overrides[host] = el.siteToggle.checked;
    save(); refresh();
  });

  // Start
  Promise.all([getSettings(), getActiveHost()]).then(function (res) {
    settings = res[0] || DEFAULTS;
    if (!settings.overrides) settings.overrides = {};
    host = res[1] || "";
    refresh();
  });
})();
