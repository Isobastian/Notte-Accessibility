# Notte — Engine v2 Design

**Status:** draft v2 — direction decided, not yet built.
**Author of record:** Isobastian · **Date:** 2026-08-17
**Purpose:** Replace the per-element DOM restyling engine with a stylesheet-transformation
engine, to kill the flash and the whole class of "firefighting" bugs, and give Notte a
maintainable foundation to grow into a full accessibility toolkit.

## Decisions locked (2026-08-17)

- **Product identity:** the extension becomes **"Notte — Accessibility & Dark Mode"** — a
  user-side accessibility toolkit for the low-vision community, with dark mode as the
  entry feature. Explicitly **not** a site-owner "accessibility overlay" (accessiBe /
  UserWay category — legally toxic, community-condemned, and against our mission).
- **Open-source.** The project stays free/libre/open-source; the license is moving toward
  **AGPL-3.0**. The repo is public.

---

## 1. Why we are changing the approach

The current engine (`chrome/content.js`, ~1360 lines) works at the **element layer**: it
walks every DOM node, calls `getComputedStyle` on each, and writes an inline `!important`
color onto the element. Everything else in the file — the `MutationObserver`,
`resyncSubtree`, the circuit breaker, the sentinel loop, `walkLight`, hover protection,
the anti-echo `STYLE_SIG`, shadow-root pruning — exists to defend that one decision
against real websites.

Two problems cannot be fixed at that layer:

- **The flash is structural.** At `document_start` no elements exist yet, so the walk
  runs *after* the browser has painted the page white, then darkens node by node. We are
  racing from second place and will always lose the first paint.
- **Cost scales with the DOM, forever.** Each element costs one layout-flushing
  `getComputedStyle` plus an inline write; the observer then re-runs that work on every
  class/attribute change. That is the "smooth at first, slower over time" behaviour, and
  why Gmail / Outlook Web trip the circuit breaker.

Every bug documented in `CLAUDE.md` is a *symptom* of element-layer restyling, not an
independent defect. Patching them one by one has diminishing returns. We change layers.

## 2. The new approach: transform the CSS, not the DOM

Notte v2 reads the page's **stylesheets** (the rules the site ships), produces a
**modified stylesheet** where every color is passed through our color model, and injects
that as an override sheet. The browser's own cascade then applies the dark colors — to
every element, including ones that do not exist yet and ones whose classes change later.

This is the model Dark Reader's "dynamic mode" uses, and it dissolves our bug class:

| Today (element layer) | v2 (stylesheet layer) |
|---|---|
| Flash: walk runs after first paint | Anti-flash `<style>` injected before first paint |
| `getComputedStyle` per element | Parse each CSS rule once |
| Observer re-restyles on every DOM mutation | Re-run only when a **stylesheet** changes |
| `resyncSubtree` for `.selected .child` states | Browser re-applies our transformed `.selected` rule itself |
| Circuit breaker / sentinel / walkLight | Not needed — work is O(rules), not O(DOM×mutations) |
| Frozen children, hover firefighting | Cascade handles states natively |

**What we keep:** the color model is good and portable. `remap()`, the HSL banding
(neutral vs accent), the `oklch` / `color(display-p3 …)` / `color(srgb …)` parsing, the
"already dark → skip" detector, and per-site `overrides` all move across nearly unchanged.

**What we delete:** the walk, `resyncEl`/`resyncSubtree`, circuit breaker, sentinel,
`walkLight`, hover protection, `STYLE_SIG`. Roughly 60% of the file.

## 2.1 Feature scope — the accessibility toolkit

Dark mode is the hook; the accessibility features are why low-vision users stay. All are
**user-side, real-time, on any website** — the opposite of a site-owner overlay. Grouped by
how each is built (which tells us what's cheap vs. a separate job).

**Core visual engine** — same stylesheet-transformation engine, different parameters; cheap
to add once the engine exists, ship together:

1. **Dark / light / auto mode** — the color engine itself.
2. **Brightness** — dim overly bright pages (folded into the color pipeline, not a page filter).
3. **Contrast** — user-set *guaranteed minimum* contrast target (AA/AAA); the WCAG angle for the reader.
4. **Font size** — scale text up on any site.
5. **Font family** — clearer or dyslexia-friendly font (e.g. OpenDyslexic).
6. **Line height & paragraph spacing** — WCAG 1.4.12 text spacing; big readability win.
7. **Letter & word spacing** — same family of adjustments.
8. **Saturation / grayscale** — tone down loud colors, or go fully gray.
9. **Sepia / warm tint** — blue-light / eye-strain reduction.
10. **Link visibility** — underline/emphasize links (not color-only).
11. **Reduced motion** — stop animations and autoplay.
12. **Strong focus outlines** — make keyboard focus clearly visible.
13. **Dim or hide images** — for users who find imagery too bright/distracting.

**Separate modules** — real standalone components, more work each:

14. **Magnifier glass** — screenshot-lens, desktop-only, hotkey-first (see §3a).
15. **Reading guide / ruler** — a tinted bar that follows the line being read; great for low
    vision & dyslexia, simple to build.
16. **Large / high-contrast cursor** — bigger, easier-to-track pointer.
17. **Read-aloud (text-to-speech)** — browser's built-in speech; useful but bigger scope — *later*.

**Cross-cutting** — wrap around all of the above:

- **Per-site memory / profiles** — remember each site's settings (extends today's `overrides`).
- **Keyboard shortcuts for every toggle** — the "reachable from everywhere" principle applied broadly.
- **One-click presets** — e.g. a "maximum readability" profile that sets several at once.

**Explicitly out of scope:** anything claiming to make a *website* WCAG-compliant, any
overlay-style widget (toxic category), and a full reader/declutter mode (large, and Safari
ships one natively).

Items 1–13 are generated CSS rules on the stylesheet layer (§2), not a new DOM walk.

## 3. Components

1. **Bootstrap / anti-flash** — at `document_start`, inject a tiny static sheet:
   `html{background:#141414 !important} html{color-scheme:dark !important}` plus a neutral
   light text color. This paints dark *before* the site paints white. Removed/replaced the
   instant the real theme sheet is ready.

2. **Stylesheet processor** (the core) — enumerate `document.styleSheets` and
   `document.adoptedStyleSheets`; for each rule, transform every color-bearing declaration
   (`color`, `background`, `background-color`, `border-*-color`, `box-shadow`, `fill`,
   `stroke`, gradients) through `remap()`. Emit one generated override sheet. Preserve
   `@media`, `@supports`, and nesting structure. Keep image `url(...)` backgrounds and
   real `<img>`/`<video>`/`<canvas>`/`<svg>` untouched, exactly as today.

3. **CSS variable / token handling** — many design systems (App Store Connect,
   Fluent/Outlook) drive color through custom properties. Transform the variable
   *definitions* (at `:root` and at the element scope where they are declared) so themed
   tokens cascade correctly, instead of chasing every consumer.

4. **Inline-style manager** — the only remaining per-element work, and small: a
   `MutationObserver` with `attributeFilter: ["style"]` only. For elements that carry an
   inline `color`/`background`, generate a targeted override *rule* (keyed by a
   `data-notte-inline="n"` id) in a dedicated sheet — do **not** rewrite the element's own
   `style`. No anti-echo signature needed, because we never fight our own writes.

5. **Cross-origin sheets** — sheets from another origin expose no `cssRules` (CORS). The
   extension background/service worker re-fetches them and hands the text back for
   parsing. This is the one piece that touches the manifest (host access for CSS fetch);
   see §5 for the per-browser cost.

6. **Dynamic watch** — re-run the processor only on *stylesheet* changes: new
   `<style>`/`<link rel=stylesheet>` added, `@import` resolved, `adoptedStyleSheets`
   mutated, CSSOM `insertRule`/`replaceSync` (the `shadow-patch.js` CSSOM hook we already
   have feeds this). Debounced. No full-DOM observation.

7. **Shadow DOM** — inject the generated sheet into each shadow root's
   `adoptedStyleSheets` (or a `<style>` inside the root). We keep the existing
   `shadow-patch.js` (`world:"MAIN"`, force `mode:"open"`, announce via `CustomEvent`) —
   it is orthogonal to the engine and still required.

8. **Mode detector + per-site override** — reuse `pageAlreadyThemed()` (sample ~10 points,
   skip pages already ≥70% dark) and the `overrides` map. Per-site override still wins.

## 3a. Magnifier module (separate from the color engine)

A cursor-following magnifier lens for **reading web pages**. Independent of the color
pipeline — an overlay + capture mechanism — so it doesn't complicate the engine.

- **Scope boundary:** an extension can only magnify *page content*, not the browser chrome,
  other apps, or the OS. It does **not** replace the system magnifier — but for reading web
  pages (the main low-vision case) it solves discoverability: no hunting for the OS tool.
- **Desktop only.** No cursor on touch, and iOS/iPadOS already ship an excellent system
  magnifier. Build for Chrome/Firefox/Safari on macOS + Windows; do **not** ship on iOS.
- **Technique:** screenshot lens via `captureVisibleTab` → magnified crop in a lens that
  follows the cursor. Avoid the DOM-clone approach (breaks on canvas/iframes/shadow DOM —
  the same complex sites that already fight us).
- **Key constraint:** `captureVisibleTab` is rate-limited to ~2 calls/sec (Chrome 92+,
  un-raisable). So: capture once, then the lens pans/zooms smoothly (60fps cursor tracking)
  over that cached image; re-capture debounced on scroll/resize and ~2×/sec. Fine for text;
  video/animation under the lens will look slightly stale. A truly live 60fps feed is not
  possible this way.
- **Access ("reachable from everywhere"):** hotkey-first — *hold a key (e.g. Alt) → lens at
  cursor, release → gone* — is the primary path; plus a panel toggle (that teaches the
  hotkey on first use); plus a right-click item **on Chrome/Firefox only** (Safari web-ext
  context menus are buggy — not persisted, need Info.plist, not dynamically managed).
  Optional always-visible floating button for users who want it. UX tension to design
  around: most-reachable (hotkey) = least-discoverable; most-discoverable (floating button)
  = most-intrusive.
- **Permissions:** works with `activeTab` (granted on user gesture, since always
  user-activated) — stays within the minimal-permissions principle, no broad host access.

## 4. Module layout

Split the monolith into small, testable modules (bundled into one `content.js` at build):

```
src/
  color/            remap(), HSL banding, oklch & color() parsing   (ported as-is)
  css/parse.ts      tokenize declarations, find color values
  css/transform.ts  rule -> transformed rule
  sheets/collect.ts enumerate same-origin + adopted sheets
  sheets/cors.ts    re-fetch cross-origin sheet text
  inline.ts         inline-style override manager
  bootstrap.ts      anti-flash sheet
  detect.ts         pageAlreadyThemed + overrides
  watch.ts          stylesheet-change observer (debounced)
  shadow.ts         shadow-root sheet injection (+ shadow-patch.js bridge)
  index.ts          lifecycle: bootstrap -> process -> watch
```

Keep the **canonical source in `chrome/` → `tools/sync.sh`** rule for the built output,
so Firefox/Safari only differ by `manifest.json`, exactly as now.

## 5. Cross-browser strategy

- **Chrome/Edge/Brave (MV3):** service worker fetches cross-origin CSS. Straightforward.
- **Firefox:** same, MV3 with `browser_specific_settings.gecko.id` + `gecko_android`
  (keep — it is what makes AMO offer it on Firefox Android).
- **Safari (iOS + macOS):** the important one. Safari's CORS and content-blocker model is
  stricter, and background fetch differs. **De-risk Safari first**, since it is where
  cross-origin sheet access is most likely to bite. If a sheet is unreadable and un-
  fetchable, fall back to the old per-element pass *for that sheet only* — a narrow, rare
  fallback, not the default path.
- **Distribution note:** the project stays open-source (AGPL), repo public. Note that
  Firefox AMO may require the *unminified source + build instructions* submitted privately
  to reviewers if the uploaded build is minified — fine for FLOSS.

## 6. Migration / rollout — deliberately incremental

We have real users (Chrome 31, Firefox 1, iOS/macOS live, ~900 ASC searches). We do **not**
break them. Plan:

1. **Prototype** the stylesheet engine as a standalone script, load it manually, and test
   it against the known-hard sites: Outlook Web, App Store Connect (incl. Analytics +
   the idmsa login iframe), MeteoSvizzera, plus a few plain content sites.
2. **Prove the two wins objectively** (see §7): flash gone, no slowdown on a
   long-lived Outlook tab.
3. **Ship behind a hidden flag** in one build (Chrome first) — v1 engine stays default,
   v2 opt-in — so we can dogfood without risking the store rating.
4. **Flip default** per browser once each is validated; Safari last.
5. **Retire v1** once v2 is proven across all three, keeping the narrow per-sheet fallback.

Target: a focused week or two of build + a real testing pass — not a weekend patch, and
not another open-ended rewrite. The point of designing first is to avoid exactly that.

## 6a. Release roadmap (decided sequencing)

1. **v2 — fix dark mode first.** Rebuild the dark-mode engine at the stylesheet layer (§2–5):
   kill the flash, delete the firefighting, prove it on the hard sites, ship as an update to
   the existing store listings. This is the immediate next piece of work. *Nothing else
   changes until dark mode is solid on the new engine.*
2. **v3 — accessibility toolkit + WCAG.** On top of the proven engine, add the core visual
   features (contrast target, font size/family, spacing, brightness, sepia, focus, reduced
   motion — §2.1 items 2–13), and rename to **"Notte — Accessibility & Dark Mode"**.
3. **Fast follows.** Magnifier (§3a), reading guide, presets, remaining toggles.

Each step is a separate piece of work — and, per the workflow, each can be run in its own
dedicated chat by pointing it at this document.

## 7. Testing / definition of done

- **Flash test:** record page load on a slow-throttled connection; the page must never
  show a white frame. (Automatable with a headless capture comparing first-paint pixels.)
- **Performance:** open Outlook Web, leave it for 30+ min of interaction; main-thread time
  and memory must stay flat (today they climb — that is the regression we are killing).
- **Contrast:** re-run the WCAG check on a sample of themed pages; keep AA everywhere,
  target the current ~11:1 average.
- **Correctness matrix:** Outlook Web, App Store Connect (+Analytics, +login iframe),
  MeteoSvizzera, Wikipedia (masked icons), a styled-components SPA, a gradient-heavy
  landing page, and a natively-dark site (must be left alone).
- **Cross-browser:** the matrix passes on Chrome, Firefox, and Safari (macOS + iOS).
- **No new permissions the stores dislike** beyond what CSS fetch strictly requires; if
  the cost is high on one browser, prefer the per-sheet fallback over a scary permission.

## 8. Open-source & licensing — decided

**Open-source.** The project stays FLOSS. The license is moving toward **AGPL-3.0** (still
OSI-approved). The repo stays **public**; no private-repo split. *Confirm any license
specifics with an IP professional; the above is orientation, not legal advice.*

## 9. Open questions to resolve before building

1. Safari cross-origin CSS: how much is actually unreadable in practice? (Spike this first.)
2. Do we bundle with a build step (esbuild) or keep hand-written single-file JS? (Modules
   argue for a tiny build step; must not complicate `tools/sync.sh`.)
3. Feature sequencing (see §2.1): confirmed order is dark mode + guaranteed contrast +
   font-size/brightness first, then spacing / focus / reduced-motion as fast follows.
