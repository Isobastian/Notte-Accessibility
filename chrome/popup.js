/* Notte - Dark Mode - logica del popup */
(function () {
  "use strict";

  var api = (typeof browser !== "undefined") ? browser : chrome;

  var DEFAULTS = {
    enabled: true,
    brightness: 100,
    contrast: 100,
    keepImages: true,
    autoSkipDark: true,
    overrides: {}
  };

  var host = "";
  var settings = null;

  var el = {
    host: document.getElementById("host"),
    siteToggle: document.getElementById("siteToggle"),
    siteDesc: document.getElementById("siteDesc"),
    resetSite: document.getElementById("resetSite"),
    brightness: document.getElementById("brightness"),
    brightVal: document.getElementById("brightVal"),
    contrast: document.getElementById("contrast"),
    contrastVal: document.getElementById("contrastVal"),
    keepImages: document.getElementById("keepImages"),
    autoSkip: document.getElementById("autoSkip"),
    globalToggle: document.getElementById("globalToggle")
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
    return settings.enabled;
  }

  function hasOverride() {
    return Object.prototype.hasOwnProperty.call(settings.overrides, host);
  }

  function refresh() {
    el.host.textContent = host || "questa pagina";
    el.siteToggle.checked = siteEnabled();
    el.siteDesc.textContent = siteEnabled() ? "Attivo" : "Disattivato";
    el.resetSite.hidden = !hasOverride();
    el.brightness.value = settings.brightness;
    el.brightVal.textContent = settings.brightness + "%";
    el.contrast.value = settings.contrast;
    el.contrastVal.textContent = settings.contrast + "%";
    el.keepImages.checked = settings.keepImages;
    el.autoSkip.checked = settings.autoSkipDark;
    el.globalToggle.checked = settings.enabled;
  }

  el.siteToggle.addEventListener("change", function () {
    if (!host) { settings.enabled = el.siteToggle.checked; }
    else { settings.overrides[host] = el.siteToggle.checked; }
    save(); refresh();
  });

  el.resetSite.addEventListener("click", function () {
    delete settings.overrides[host];
    save(); refresh();
  });

  el.brightness.addEventListener("input", function () {
    settings.brightness = parseInt(el.brightness.value, 10);
    el.brightVal.textContent = settings.brightness + "%";
    save();
  });

  el.contrast.addEventListener("input", function () {
    settings.contrast = parseInt(el.contrast.value, 10);
    el.contrastVal.textContent = settings.contrast + "%";
    save();
  });

  el.keepImages.addEventListener("change", function () {
    settings.keepImages = el.keepImages.checked;
    save();
  });

  el.autoSkip.addEventListener("change", function () {
    settings.autoSkipDark = el.autoSkip.checked;
    save();
  });

  el.globalToggle.addEventListener("change", function () {
    settings.enabled = el.globalToggle.checked;
    save(); refresh();
  });

  // Avvio
  Promise.all([getSettings(), getActiveHost()]).then(function (res) {
    settings = res[0] || DEFAULTS;
    if (!settings.overrides) settings.overrides = {};
    host = res[1] || "";
    refresh();
  });
})();
