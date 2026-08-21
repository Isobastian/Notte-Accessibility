/*
 * Dynamic watch — the v2 replacement for v1's full-DOM MutationObserver,
 * circuit breaker and sentinel loop.
 *
 * We only care about *stylesheet* changes now, because the cascade handles
 * everything else. Triggers:
 *   - a <style> or <link rel=stylesheet> added/removed,
 *   - a stylesheet finishing load,
 *   - CSSOM edits (insertRule / replaceSync) reported by shadow-patch.js via
 *     the __notte_css_changed__ event (styled-components et al.).
 * All coalesced with a debounce that is capped so a site inserting rules
 * continuously can't defer the re-run forever (v1's "white cards on ASC" fix).
 */
function isOurs(n) { return n && n.getAttribute && n.getAttribute("data-notte") !== null; }

export function createStylesheetWatcher(onChanged) {
  var timer = null, first = 0;

  function schedule() {
    var now = Date.now();
    if (!timer) first = now; else clearTimeout(timer);
    var wait = (now - first > 500) ? 0 : 150;   // guarantee a pass within ~500ms of the first signal
    timer = setTimeout(function () { timer = null; onChanged(); }, wait);
  }

  var mo = new MutationObserver(function (muts) {
    for (var i = 0; i < muts.length; i++) {
      var m = muts[i];
      var added = m.addedNodes || [];
      for (var j = 0; j < added.length; j++) {
        var n = added[j];
        if (n.nodeType !== 1 || isOurs(n)) continue;
        if (n.tagName === "STYLE") schedule();
        else if (n.tagName === "LINK" && /stylesheet/i.test(n.rel || "")) {
          schedule();
          n.addEventListener("load", schedule);
        }
      }
      var removed = m.removedNodes || [];
      for (var k = 0; k < removed.length; k++) {
        var rn = removed[k];
        if (rn.nodeType === 1 && !isOurs(rn) && (rn.tagName === "STYLE" || rn.tagName === "LINK")) schedule();
      }
    }
  });

  try { mo.observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {}
  document.addEventListener("__notte_css_changed__", schedule, true);

  return {
    stop: function () {
      if (timer) clearTimeout(timer);
      mo.disconnect();
      document.removeEventListener("__notte_css_changed__", schedule, true);
    }
  };
}
