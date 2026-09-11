# CLAUDE.md — Notte — Accessibility & Dark Mode

Context for Claude, or any contributor, working on this repository.

## What it is

Notte is a **free** browser extension that darkens overly bright websites. It was
born as an **accessibility tool for the low-vision community** (the author has a
degenerative eye condition). It must stay free, with no ads, no donations and no
tracking.

One codebase, three browsers: **Chrome, Firefox, Safari** (Safari covers iPhone,
iPad and Mac).

## Product identity & scope

- **Name:** **Notte — Accessibility & Dark Mode** (the `name` in all three
  `manifest.json` files). Tagline: *from dark mode to full accessibility*.
- **Pillar = accessibility.** Notte is a **user-side low-vision accessibility
  toolkit**; dark mode is the *entry* feature, not the whole product. It is
  explicitly **not** a site-owner "accessibility overlay" (accessiBe / UserWay
  category — legally contested, community-condemned, against the mission).
- **Licence: MIT** (see `LICENSE`). Do not relicense without a deliberate
  decision by the maintainer — AGPL-family terms conflict with Apple's App Store
  rules, and Notte ships on the App Store. Sole authorship is what keeps that
  decision open: accepting an outside contribution without a CLA ends the ability
  to change or except the licence unilaterally.
- **Docs language:** this repository is **English-only**. Keep new docs and
  comments in English.
- **Funded, unfunded and roadmap status live outside this file.** This file is
  about the code.

## AI provenance

Notte's code is written by an AI assistant from the maintainer's specifications.
The design, architecture and accessibility decisions and the testing are the
maintainer's. `README.md` carries the full provenance note. Every commit carrying
model-written content gets an `Assisted-by: <model identifier>` trailer, from
**10 September 2026** onward; history before that date is covered by a blanket
statement in the README, because git history cannot be annotated retroactively.
**If you change code here, include that trailer.**

## Principles to respect (important)

- **Free & unmonetized.** No "Donate" buttons, no in-app purchases, no ads, no
  analytics/tracking. No data collection.
- **Accessibility first.** Large controls, readable text, high contrast in the
  popup. Always think of people with low vision.
- **Minimal permissions.** `storage` + `activeTab` for the UI, plus
  `host_permissions` used **only** so the background service worker can re-fetch
  cross-origin stylesheets (see the engine below). No other permissions. The
  service worker is a pure fetch relay — it stores and sends nothing.
- **Guaranteed contrast.** Dark backgrounds and light text at a high contrast
  ratio (WCAG). No muddy greys.
- **Color remapping, not inversion.** Never use `filter: invert()`.
- **Simplicity is the rule.** One engine, plain editable files, no build step,
  no hidden generated code. If a change makes the folder harder to understand,
  it's the wrong change.

## Repository structure

```
chrome/     CANONICAL source + master icons. EDIT HERE, then run sync.sh.
              content.js       the dark-mode engine (one self-contained file)
              shadow-patch.js  MAIN-world shadow-DOM + CSSOM hook
              background.js    service worker: cross-origin CSS fetch relay
              popup.html       the popup UI
              popup.js         the popup logic
              manifest.json    Chrome manifest
              images/          master extension icons (48…512) — synced to the others
              fonts/           bundled OpenDyslexic woff2 + OFL.txt — synced to the others
              _locales/        UI strings: en (British, default) · en_US · it · fr · de · es
firefox/    Same shared files + Firefox manifest (adds browser_specific_settings.gecko
              id + gecko_android for Firefox-Android; background uses "scripts").
safari/     Same shared files + Safari manifest, wrapped with Xcode for iOS + macOS.
              app-icons/       the macOS/iOS APP icons (Safari-only; set in Xcode).
tools/sync.sh   Copies the shared files (content.js, shadow-patch.js, background.js,
                popup.html, popup.js, images/, fonts/, _locales/) from chrome/ into
                firefox/ and safari/. It ADDS and OVERWRITES but never deletes: a
                locale removed from chrome/_locales must be deleted by hand in the
                other two.
docs/           engine-v2-design.md (the engine design), store-listings.md.
README.md · LICENSE · CHANGELOG.md · CONTRIBUTING.md · CODE_OF_CONDUCT.md ·
SECURITY.md · ACCESSIBILITY.md · PRIVACY.md
.github/ISSUE_TEMPLATE/  bug_report.md · feature_request.md · config.yml
.gitattributes  Normalizes line endings across Mac and Windows machines.
```

**Canonical source = `chrome/`.** `content.js`, `shadow-patch.js`,
`background.js`, `popup.html`, `popup.js` and `images/` are identical in the three
folders; only `manifest.json` differs.

Golden rule: **edit the shared files in `chrome/` only, then run
`bash tools/sync.sh`** to realign `firefox/` and `safari/`. Never hand-edit the
same shared file in the three folders.

**No build step.** `content.js` is a single self-contained file you edit
directly — there is no `src/`, no `dist/`, no compiler. (An earlier `engine-v2/`
folder held a modular `src/` + an esbuild build that compiled to `dist/`; it was
removed in favour of this single-file layout because the compiled file and the
source drifted apart and it was confusing to maintain solo.)

## How the engine works (stylesheet-transformation engine)

Notte does **not** walk the DOM and restyle elements one by one. It reads the
page's **stylesheets**, remaps every color through our color model, and injects a
single generated override sheet. The browser's own cascade then applies the dark
colors to every element — including ones that don't exist yet and ones whose
classes change later. Work is proportional to the number of CSS rules, not to the
DOM size × mutations, so it stays fast on long-lived apps (Outlook Web, Gmail).

Three files do the work: `content.js` (the engine), `shadow-patch.js` (shadow-DOM
bridge, MAIN world), and `background.js` (service worker that re-fetches
cross-origin CSS). Cross-browser shim everywhere:
`var api = (typeof browser!=='undefined') ? browser : chrome;`

**Lifecycle** (per frame; `all_frames:true`, `document_start`):

1. **Anti-flash cover.** Before the page paints, inject a broad cover sheet that
   makes *every* element flat dark (`background #141414`, text `#e8e6e3`), with
   real media (`img/video/canvas/svg/picture/iframe`) kept natural. This kills
   the white flash. A companion "no-transition" sheet is injected during theming
   so color changes don't animate, and is removed once the page settles.
2. **Decide.** Per-site `overrides` win; a per-site dark switch can be off; else
   the `pageAlreadyThemed()` detector samples the page's **original** backdrop
   (cached once, with our own sheets briefly disabled so we read the site's real
   colors) and skips pages that already ship a dark theme. The decision is
   exposed as `data-notte-auto`.
3. **Transform.** Enumerate `document.styleSheets`, `adoptedStyleSheets`, and each
   shadow root's sheets. For every rule, remap the color declarations and emit one
   override sheet (`__notte_theme__`) plus a small base sheet (`__notte_base__`:
   `color-scheme:dark` + scrollbar colors). Cross-origin sheets (no `cssRules`
   under CORS) are re-fetched by `background.js`, parsed with a constructable
   `CSSStyleSheet`, transformed, and appended to `__notte_cors__`.
4. **Lift the cover.** The cover comes off as soon as the **stylesheets are
   themed** — not when the DOM stops changing. It earlier waited for the page to go
   "quiet" (no DOM node added for ~1s), which kept a busy SPA (Outlook Web) flat-
   dark for 2–3s even though the theme was already applied; new elements are themed
   by the cascade automatically, so they never needed the cover. Now it lifts once
   the DOM is parsed (`readyState !== "loading"`), same-origin sheets are
   transformed, and no cross-origin fetch is pending (short ~250ms settle, 4s hard
   cap). Element churn no longer holds it — only genuine stylesheet work (pending
   fetches, newly added sheets) does.
5. **Watch.** Re-run the transform only when a **stylesheet** changes (new
   `<style>`/`<link>`, CSSOM `insertRule`/`replaceSync` reported by
   `shadow-patch.js`, adopted-sheet changes), debounced. On SPA route change
   (`__notte_route_changed__`) the cover is re-armed and the page reprocessed.

**Color model** (`parseColor` + `remap`): understands `hex`, `rgb/rgba`, `hsl`,
`oklch(...)`, `color(srgb|display-p3 ...)` (needed on Safari/Apple sites), named
colors, and bare channel triplets — including the **modern space-separated syntax
with a `/ alpha`**, e.g. `rgb(222 245 255 / var(--tw-bg-opacity,1))` (Tailwind v3 /
CSS Color 4). `parseColor` extracts the function body with paren-matching, so a
`var()` alpha no longer defeats it (that bug left Tailwind buttons and panels
white). Remap is HSL banding: neutral (low-saturation) backgrounds → a fixed dark;
accent colors → a lighter, separated band so highlights stay visible; text → a
light band; borders → neutral/accent. Hue and saturation are preserved (accent
saturation capped to avoid neon). Text/background contrast stays high (targets WCAG
AA; ~11:1 average in testing, measured against a fixed reference background rather
than the surface actually painted behind the glyphs — see *Known limits*). CSS
custom properties get dark **variants** (background/foreground/border roles) — and
when a variable is defined several times across selectors, a CSS-wide keyword
(`initial`/`inherit`/`unset`/`revert`) is not allowed to clobber a real colour
definition in the flattened var map (that bug left `var(--link-color)` link text
un-themed on DeepL). SVG paints (`fill`/`stroke`) and HTML color attributes
(`bgcolor`, `<font color>`) are handled; `light-dark()` / Tailwind fallbacks are
covered. Light gradients are switched off; `url(...)` images and real media are
left untouched.

**Shadow DOM.** Content scripts run in an isolated JS world, so `shadow-patch.js`
is injected with `world:"MAIN"`: it forces `mode:"open"` even on closed roots,
announces new roots via a `CustomEvent`, and hooks the CSSOM
(`insertRule`/`replaceSync`) so styled-components rules that arrive with no DOM
mutation still get themed. `content.js` injects the generated sheet into each
shadow root and covers new roots during the loading window.

**Inline styles.** Elements with an inline `style` beat any sheet, so a small
`MutationObserver` (`attributeFilter:["style"]` only) gives each one a
`data-notte-inline` id and writes a targeted override *rule* in a dedicated sheet
— we never rewrite the element's own `style`, so there's nothing to fight.

**Overlay layering (hard-won — keep the two layers separate).** WebKit **drops
`backdrop-filter` entirely when the same element also carries
`mix-blend-mode`**. The page-global effects used to share one div, so on Safari,
turning Warm tint on silently killed Brightness *and* Saturation — only the warm
multiply painted, which looked like "Saturation can't reach 0" (colours muted a
little, never grey). Chrome and Firefox composite both properties on one element,
so it looked right there and the bug was Safari-only. Splitting into two sibling
divs is pixel-identical in Chrome (measured: same chroma and luminance) and fixes
Safari. **Paint order matters**: the warm layer must sit *above* the filter layer
— put it below and the filter desaturates the tint itself, so Warm tint stops
doing anything at all. Also note `backdrop-filter: url(#svgFilter)` is **not**
supported in Safari, so an SVG `feColorMatrix` is not an alternative here.

**Scrollbars / platform notes (hard-won — keep verbatim in `content.js`).**
`color-scheme:dark` is set on every element (a descendant declaring
`color-scheme:light` would otherwise win). Custom scrollbars are forced via both
standard `scrollbar-color` and the `::-webkit-scrollbar*` pseudo-elements with an
ID-level specificity bump; on Safari/macOS the `::-webkit-scrollbar` path is the
one that works, and border/box-shadow/outline must be zeroed too or a white edge
remains. Every per-element step is wrapped in try/catch so one odd value can't
stop the pass.

**Text selection (hard-won — keep both rules in `baseCSS()`).** Notte used to
leave `::selection` alone, so the browser's own selection colours applied — built
for a light page. The **unfocused** pair is the real problem: every engine
repaints the selection with an "inactive" colour the moment the window goes to
the background, and Chromium's is a mid grey `#6a6a6a` with near-black text
(~1.9:1), so the selection vanished exactly when you switched window to use it.
The base sheet now declares `#a09bdd` behind `#141414` text — 7.4:1 against the
text *and* 7.4:1 against the `#141414` page, so the highlight itself is
unmistakable. `text-shadow:none` stops a site glow smearing the selected glyphs,
and `-webkit-text-fill-color` is set alongside `color` because a
`background-clip:text` gradient heading has a transparent fill that swallows
`color` alone. Every engine Notte ships on honours an author `::selection` in
**both** the focused and the unfocused state, so one rule covers both; the second
rule, `::selection:window-inactive`, is Safari insurance — WebKit's own
pseudo-class, parsed by Chromium, dropped by Firefox as unknown.
**Verified in both engines, in both states:** Chromium headless (pixel-compared,
focused vs unfocused) and Firefox 155 on Windows. The two engines failed
*differently*, which is why both declarations are load-bearing: Chromium forces
its own near-black foreground onto a grey background, while Gecko keeps its light
grey behind the **page's** text colour (`#e8e6e3` on a Notte page — light on
light, invisible), so only `color` rescues Firefox and only `background-color`
rescues Chromium.
Do **not** trust [bugzilla 706209](https://bugzilla.mozilla.org/show_bug.cgi?id=706209)
("no way to style the selection in inactive windows"): it is still open, but
Gecko has moved on and modern Firefox applies both halves. Firefox parses
neither `::selection:window-inactive` nor `::inactive-selection` (verified),
which is exactly why the two selectors live in **separate rules** — an unknown
selector invalidates the whole rule it sits in, so merging them would take the
working one down with it in Gecko.

### Settings model (`storage.local`)

```js
{
  overrides:  { "example.com": true|false }, // per-site extension on/off
  dark:       { "example.com": false },      // per-site dark-mode off switch
  contrast:   { "example.com": "aaa" },      // guaranteed contrast target (OFF<->AAA; legacy "aa" still honoured)
  // v3 tools — per site, applied on dark AND bright pages:
  warmth:     { "example.com": true },       // warm tint (cut blue light)
  links:      { "example.com": true },       // underline every link
  motion:     { "example.com": true },       // reduce motion
  focus:      { "example.com": true },       // strong focus outline
  brightness: { "example.com": 0..100 },     // <100 dims the page (100 = off)
  saturation: { "example.com": 0..100 },     // <100 mutes colour, 0 = grey (100 = off)
  dimimg:     { "example.com": 0..100 },     // <100 dims images (100 = off)
  textsize:   { "example.com": 0..100 },     // >0 enlarges text (0 = off)
  letter:     { "example.com": 0..100 },     // >0 adds letter/word spacing (0 = off)
  paragraph:  { "example.com": 0..100 },     // >0 opens up line spacing (0 = off)
  font:       { "example.com": "dyslexic" }  // clearer/dyslexia-friendly font ("off" = default)
}
```

Sliders store **0..100 (track position)**; the popup stays generic and the engine
(`loadAndRender`) maps each value to its real effect, treating the no-op end as
"off". `content.js` and `popup.js` each carry their own key list / `DEFAULTS`. If
you change the data shape in one, check the other.

### Modes & where tools apply (v3)

`theme.mode` is **`dark` | `light` | `off`**. Notte activates when dark mode
applies **or any tool is on**, on any page:

- **`dark`** — full colour remap; every tool layers on top.
- **`light`** — a **bright page** (dark off) with tools on. The page keeps its own
  light colours: `transformDeclaration`/`remap` are gated to **text only** and only
  when **Contrast** is set (it *darkens* text toward black against a light
  reference — the mirror of the dark path). No dark cover, no dark base sheet.
- **`off`** — nothing injected.

Tools split by how they're applied (all of it in `chrome/content.js` — there is no `src/`):

- **Contrast** → `remap()` fg path (dark: brighten; light: darken). `lightContrast`
  gates the text pass so we never darken text on an already-dark page.
- **Warm tint / Brightness / Saturation** → **two** fixed sibling layers, never
  one div: `#__notte_overlay__` (`backdrop-filter: saturate() brightness()`,
  z-index 2147483646) and, above it, `#__notte_warm__` (warm `multiply`,
  z-index 2147483647). Works in both modes; avoids `filter` on `<html>` (which
  breaks `position:fixed`). **Do not merge them back into one element** — see the
  WebKit note above.
- **Links / Reduce motion / Strong focus / Dim images / Text size / Letter+word
  spacing / Paragraph (line) spacing / Font** → one injected `#__notte_adjust__`
  rule sheet (`buildAdjustCSS`).

Everything Notte injects carries `data-notte` so our own observers skip it.

### Known limits of the current engine

Worth knowing before you change the colour model:

- **Contrast is measured against an assumed backdrop.** `remap()` brightens text
  until it clears a ratio against a fixed reference (`AA_BG` = `#2c2c2c`, or
  `#404040` when the Contrast tool is on). At rule-transform time there is no way
  to know which surface the text will actually land on, and the background ramp
  can reach L=46% for a saturated colour. A text colour and the colour behind it
  are therefore decided by two passes that never meet.
- **The custom-property map is flattened per document.** `collectVarDefs()` is
  last-wins across the whole document, and the three emitted role variants
  (`--nt-bg-` / `--nt-fg-` / `--nt-br-`) are a guess about how a variable will be
  used. A site that redefines the same variable in several scopes collapses to one
  value.
- **HSL lightness is not perceptual.** `dampS()`, `accentFactor()`, the
  `BG_L_FLOOR → BG_L_PEAK` ramp and the `S > 40` threshold are all corrections
  around that.
- **Some colour functions pass through untouched.** `parseColor()` returns `null`
  for `lab()`, `lch()`, `oklab()` and `hwb()`, and `color-mix()` is not handled at
  all — those surfaces stay bright.
- **The cross-origin sheet is append-only.** `fetchAndApply()` does
  `textContent +=`, so a settings change re-themes same-origin CSS live while
  already-fetched cross-origin sheets update only on the next page load.
- **Content scripts do not hot-swap.** A new `content.js` takes effect in a tab
  only after that page is reloaded — after reloading the extension, refresh the
  test tabs.

## Localisation (popup UI)

Six locales live in `chrome/_locales/`, mirrored by `sync.sh`:

```
en/      British English — the default_locale, ~57 messages
en_US/   American English — 2 messages only
it/  fr/  de/  es/
```

**`en_US` holds two strings, not fifty.** Chrome falls back to the default locale
*per message*, so the American file contains only what actually differs — `links`
("Emphasize links") and `saturation_desc` ("colors… gray"). Nothing else in the UI
is spelled differently, so the file cannot drift. A browser set to `en-GB`, `en-AU`,
`en-NZ`, `en-IE` or `en-ZA` finds no exact match, falls back to `en`, and gets
British. Only `en-US` takes the override.

**Strings are read by hand, not via `api.i18n.getMessage()`.** `popup.js` fetches
`_locales/<locale>/messages.json` itself and looks up through `t(key, fallback)`.
Two reasons, both deliberate — do not "simplify" this back to `getMessage()`:

1. `getMessage()` is locked to the browser UI locale with no runtime override. Going
   through `t()` means adding a language picker later is one variable, not a rewrite.
2. It allows the accept-languages fallback: when the browser UI is in a language we
   do not ship, the user's *preferred* languages are tried before English. This is
   the managed-Chromebook case — ChromeOS is ~45% of Chrome installs and those
   machines are usually `en-US` whoever is reading.

Every lookup passes an English fallback (`t(it.id, it.name)`), so a failed fetch
degrades to the English baked into `ITEMS` and `popup.html`, never to blank labels.

**No language picker, by design.** Notte follows the browser, like every other
extension. If one is ever wanted it belongs on an options page, not in the popup.

**Testing a language:** open the popup as an ordinary page with a `?lang=` parameter —
`chrome-extension://<id>/popup.html?lang=de` — and edit the address bar to switch.
No restart, no second profile. Users never hit this: the browser opens the popup with
no query string. Note the tab is wider than the real popup, so confirm tight layouts
by clicking the toolbar button.

**Adding a string:** add the key to all six `messages.json`, use `t("key", "English")`
in `popup.js` or `data-i18n="key"` in `popup.html`, then run `sync.sh`.

### Tools that are not built yet

The six unfinished tools (read aloud, reading ruler, magnifier, large cursor, preset,
shortcuts) show their **name inside a chip with a clock icon** (`.soonchip`), and
their control is dimmed (`.item.pending`). There is deliberately **no badge word on
screen**: a separate "SOON" pill sat beside `.name`, which is `white-space:nowrap`
and cannot shrink, so it capped how long any translated tool name could be — Italian
*Righello di lettura* + *IN ARRIVO* overflowed the 360px popup. The wording survives
as a screen-reader-only label (`pill_soon`, sentence case because some screen readers
spell out capitals), so a blind user still hears that the tool is not ready, in their
language. The chip reuses the old `.pill` background, border and radius, and
`#a09bdd` was already the pill's text colour — no new tokens.

## Build / quick test

There is no build — just load the folders.

- **Chrome / Edge / Brave:** `chrome://extensions` → Developer mode → *Load
  unpacked* → the **`chrome/`** folder.
- **Firefox:** `about:debugging` → *Load Temporary Add-on* → any file in
  **`firefox/`**.
- **Safari:** on a Mac →
  `xcrun safari-web-extension-converter ./safari --app-name "Notte" --bundle-identifier com.yourname.notte --project-location ~/Desktop`
  → open in Xcode, set the signing Team, Run. The macOS/iOS app icons live in
  `safari/app-icons/`. The Safari bundle identifier must be unique.

Check which engine is running: in the page console,
`document.documentElement.getAttribute('data-notte-build')`.
`data-notte-auto` shows the "already dark?" detector's decision.

## Manifest differences (only file that differs per browser)

- **Chrome / Safari:** `"background": { "service_worker": "background.js" }`.
- **Firefox:** `"background": { "scripts": ["background.js"] }` (Firefox MV3),
  plus `browser_specific_settings.gecko` (`id`, `strict_min_version: "128.0"`,
  `data_collection_permissions: { required: ["none"] }`) and `gecko_android`.
- All three: `manifest_version: 3`, `default_locale: "en"`,
  `permissions: ["storage","activeTab"]`,
  `host_permissions: ["<all_urls>"]`, and the two content scripts
  (`shadow-patch.js` in `world:"MAIN"`, then `content.js`) at `document_start`,
  `all_frames:true`.

`sync.sh` never copies manifests — edit each by hand and keep the three versions
equal.

## Checks before committing

- JSON-validate all 3 manifests:
  `python3 -c "import json;json.load(open('chrome/manifest.json'))"` (and firefox/safari).
- JSON-validate the locale files too — a malformed `messages.json` makes the whole
  extension fail to load, not just that language.
- If you touched popup strings: check the popup in a long language (German) at
  maximum Text size. See *Localisation* for how to open one.
- `node --check` on `content.js`, `background.js`, `shadow-patch.js`, `popup.js`.
- Test on at least one light site and one site with its own dark mode.
- If you touched the shared files: run `bash tools/sync.sh`.
- Make sure the debug timing logs are off — `var NBG = false` in `content.js` —
  before any store upload. Turn them on only while debugging locally.
- Include the `Assisted-by: <model identifier>` trailer if the commit carries
  model-written content.

## Publishing / releases

- Bump `version` in the **three** `manifest.json` files each release (keep them
  equal). Also create a matching **git tag** + a **GitHub Release**, and add a
  `CHANGELOG.md` entry.
- Note the broad `host_permissions` in the store review at each submission.
- **All three listings are live and public:**
  - Chrome Web Store — https://chromewebstore.google.com/detail/lmackbhliaaledjdnkhjnfheideaefmj
  - Firefox AMO — https://addons.mozilla.org/firefox/addon/notte-accessibility-dark-mode/
  - App Store ("Notte — Accessibility"; iPhone, iPad, Mac, Vision) —
    https://apps.apple.com/app/id6789895424
- Uploading an update: zip the **contents** of `chrome/` or `firefox/` so
  `manifest.json` sits at the top of the zip — never zip the folder itself. Build
  the zip outside the repository. Safari ships from Xcode, not a zip. We ship
  unminified source, so AMO needs no separate source upload.
- Store-listing metadata (incl. Safari's 30/30/100 title/subtitle/keywords):
  `docs/store-listings.md`.

## Roadmap

- **Now — dark mode + the v3 toolkit on the stylesheet-transformation engine,
  live on all three stores.** The engine is the shipping engine and is solid on
  the hard sites; the v3 tools are wired and live on **dark AND bright** pages.
  **Wired:** Contrast (OFF↔AAA), Warm tint, Emphasize links, Reduce motion,
  Strong focus, Brightness, Saturation, Dim images, Text size, Letter spacing,
  Paragraph spacing, Font. Each reads a per-site key into the `theme` object
  (`loadAndRender`) and is applied by `remap()` (Contrast), the overlay
  (warmth/brightness/saturation), or the `#__notte_adjust__` rule sheet
  (everything else).
- **Font — done:** real **OpenDyslexic** is bundled (`chrome/fonts/*.woff2` +
  `OFL.txt`, an `@font-face` in `content.js`, files declared in
  `web_accessible_resources`, mirrored by `sync.sh`). **Text size** scales the
  root `font-size`, so rem-based sites benefit most; px-hardcoded sites less.
- **Still to build — standalone modules, not page-CSS tools:** Read aloud (TTS),
  Reading ruler, Magnifier, Large cursor, and the Profile plumbing (Remember /
  Preset / Shortcuts). Build these as their own components.
- **Also open:** tuning the slider→effect maps in `loadAndRender`
  (`content.js`): text scale `1 + pct/100*0.8`, letter `pct/100*0.2em`,
  line-height `1.5 + pct/100*0.7`, brightness/saturation/dimimg = `pct/100`.
  Try them on real sites and adjust the ranges to taste.
- **Also open:** an automated harness that measures the contrast Notte actually
  delivers across a corpus of real sites and fails on regressions — see
  *Known limits*.

## Contributing

Read `CONTRIBUTING.md` first. The short version: edit in `chrome/`, run
`tools/sync.sh`, run the checks above, keep the file count flat, and don't
introduce a build step. If something in the repository surprises you, ask before
changing it — several of the notes above look like over-engineering and are not.

GitHub repo: `Isobastian/Notte-Accessibility`.
