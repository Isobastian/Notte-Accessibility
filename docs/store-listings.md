# Store listings — metadata for each browser store

The **extension name** (the `name` field in every `manifest.json`) is identical
everywhere:

**Notte — Accessibility & Dark Mode**

Tagline used in the listings and the README heading: *from dark mode to full
accessibility.*

Strategy: the accessibility mission leads (for users),
while the term people actually search — **"dark mode"** — stays in a high-weight
search field so discovery is preserved. Fill the values below into each store's
dashboard.

## Chrome Web Store
- **Name:** Notte — Accessibility & Dark Mode
- **Short description (max 132 chars):**
  `High-contrast dark mode & accessibility for low vision — make any bright site comfortable to read. Free, no ads, no tracking.`
- **Detailed description:** open the FIRST paragraph with a sentence containing
  both "dark mode" and "accessibility" (Chrome weights the first paragraph most);
  then tell the low-vision mission and the roadmap. Chrome has **no separate
  keyword field** — keywords must appear naturally in this description.

## Firefox (AMO)
- **Name:** Notte — Accessibility & Dark Mode
- **Summary:** same text as the Chrome short description.
- **Tags / keywords:** dark mode, accessibility, low vision, high contrast,
  night mode, readability.

## Safari (App Store Connect) — the strict one: 30 / 30 / 100

Apple counts spaces toward every limit. The full extension name is 33 chars, so the
*listing title* is trimmed; the extension name inside the app stays the full
"Notte — Accessibility & Dark Mode".

Positioning: **accessibility leads**. The title carries the mission, the subtitle
carries the term people actually search ("dark mode"), and the keyword field picks
up everything neither one says. Apple does **not** index the description for
search, so the description is written for the reader, not the algorithm.

### App Name (max 30) — 21 chars
```
Notte — Accessibility
```

### Subtitle (max 30) — 24 chars
```
Dark mode for low vision
```
Second-highest ranking field. Carries both "dark mode" and "low vision", which is
why neither appears in the keyword list below.

### Keywords (max 100, comma-separated, NO spaces) — 89 chars
```
nightmode,eyestrain,contrast,readability,dyslexia,brightness,visualaid,glare,dimmer,sight
```
Rules Apple enforces or rewards: never repeat a word already in the app name or
subtitle (it is wasted space — they are indexed anyway), no spaces after commas,
singular forms only, and no competitor names.

### Promotional Text (max 170) — 164 chars
Editable **without** a new review, so use it for seasonal or roadmap news later.
```
Dark mode is only the start. Contrast, brightness, saturation, text size, spacing and dyslexia-friendly fonts — per site, on any website. Free, no ads, no tracking.
```

### Description (max 4000) — 2411 chars
```
Notte makes the web easier to see.

It is a free, user-side accessibility tool for people with low vision, built by someone living with a degenerative eye condition. It works on every website you visit, in Safari on iPhone, iPad and Mac.

Dark mode is where Notte starts. It is not where it stops.

HIGH-CONTRAST DARK MODE

Notte does not invert colours. It reads each page's own stylesheets and remaps every colour in HSL, so backgrounds go deep and text goes bright while buttons, links and highlights stay distinct and recognisable. Contrast stays high — around 11:1 in testing, well past the WCAG AA threshold. Sites that already ship a good dark theme are detected and left alone. Photographs, video and illustrations keep their natural colours.

THE ACCESSIBILITY TOOLKIT

Every control is per-site and remembered, so a page you struggle with stays adjusted the way you need it, every time you come back:

• Contrast — hold text to a guaranteed WCAG AAA contrast target
• Brightness — dim pages that are painful to look at
• Saturation — mute strong colour, or go fully greyscale
• Warm tint — cut blue light for long or late reading
• Dim images — soften bright or busy pictures
• Text size — enlarge text on any site
• Letter and word spacing — open up crowded type
• Line spacing — give paragraphs room to breathe
• Font — switch to a clearer, dyslexia-friendly face (OpenDyslexic is bundled, so it works offline)
• Emphasise links — underline every link so it is unmistakable
• Strong focus — a thick, high-visibility outline for keyboard navigation
• Reduce motion — stop animation and parallax

The tools work whether dark mode is on or off. You can keep a page's own light design and still raise its contrast, enlarge its text, or calm its colour.

FREE, AND STAYING THAT WAY

No ads. No subscriptions. No in-app purchases. No donations. Notte collects no data of any kind — no analytics, no tracking, no accounts. Nothing leaves your device; your settings stay on it. Notte asks only for the access it needs to restyle the pages you open, and the source code is public so anyone can check that for themselves.

A USER-SIDE TOOL

Notte adapts pages for you, in your own browser. It is the opposite of a website "accessibility overlay": it never changes a site for anyone else, and it makes no claim about any site's compliance.

Notte is open source. Questions, ideas and contributions are welcome.
```

### What's New in This Version (max 4000) — 820 chars
```
Notte 2.0 is a complete rebuild.

• A new engine. Instead of restyling elements one at a time, Notte now remaps each page's own stylesheets, so the theme holds as pages change and stays fast on long-lived web apps like webmail.
• A full accessibility toolkit: guaranteed contrast, brightness, saturation, warm tint, dim images, text size, letter and word spacing, line spacing, dyslexia-friendly fonts, emphasised links, strong focus outlines and reduced motion — each one per site, and remembered.
• Every tool now works on ordinary bright pages too, not only in dark mode.
• OpenDyslexic is bundled, so the dyslexia-friendly font works offline.
• Better colour handling on modern sites, including oklch() and Display-P3 colours.
• Fixed: Saturation and Brightness did nothing in Safari while Warm tint was switched on.
```

### Notes for App Review
Paste into the **App Review Information → Notes** box. Extensions that arrive with
no enabling instructions are a common rejection: the reviewer opens the app, sees
a container app that "does nothing", and rejects it.
```
Notte is a Safari web extension; the app itself is the container.

To test:
1. iPhone/iPad: Settings → Apps → Safari → Extensions → Notte (on older iOS: Settings → Safari → Extensions) → turn on, then set website access to Allow.
   Mac: Safari → Settings → Extensions → tick Notte, then Edit Websites → Allow.
2. Open any bright website (for example w3.org or wikipedia.org).
3. Tap or click the Notte button in the Safari toolbar to open the controls.
4. The main switch applies dark mode. The VISION and READING tabs hold the per-site tools (contrast, brightness, saturation, warm tint, dim images, text size, spacing, font, links, motion, focus).

Website access is required because Notte reads and rewrites each page's stylesheets to remap its colours. Nothing is transmitted anywhere: there is no server, no analytics, no account, and settings are stored on device only. The extension's background script is a fetch relay used solely to re-download cross-origin stylesheets that the page has already loaded, so their colours can be remapped too; it stores and sends nothing.
```

### The rest of the distribution fields
- **Primary category:** Utilities. **Secondary:** Productivity.
  (The App Store has no Accessibility category; Utilities is where Safari
  extensions sit.)
- **Age rating:** 4+ — no objectionable content of any kind.
- **App Privacy:** **Data Not Collected**, every category. Notte has no server, no
  analytics and no account; settings live in `storage.local` on the device.
- **Privacy Policy URL:** *required by Apple even when nothing is collected.*
- **Support URL:** required. The GitHub issues page works:
  `https://github.com/Isobastian/Notte-Accessibility/issues`
- **Marketing URL:** optional —
  `https://github.com/Isobastian/Notte-Accessibility`
- **Copyright:** `2026 Sebastian Nicosia`
- **Export compliance:** Notte uses no encryption. Add
  `ITSAppUsesNonExemptEncryption = NO` (Boolean) to the app's `Info.plist` and the
  question stops being asked on every upload.
- **Pricing:** Free, all territories. No in-app purchases — this is a project
  principle, not just a current state.

### macOS-only build requirements (learned the hard way)
Two validation failures that only ever hit the **Mac** upload, never iOS:

- **`LSApplicationCategoryType` is mandatory on macOS.** The Mac App Store rejects
  an archive whose Info.plist has no category UTI. In Xcode this is the **App
  Category** dropdown in *General → Identity* on the **Notte (macOS)** target
  (build setting: `INFOPLIST_KEY_LSApplicationCategoryType`). Set it to
  **Utilities** (`public.app-category.utilities`) to match the ASC category. iOS
  has no such requirement, so an iOS upload sails through with it missing.
- **Build numbers are counted per platform, and only ever go up.** iOS and macOS
  keep separate `CFBundleVersion` sequences on the same app record, so the same
  `CURRENT_PROJECT_VERSION` can be fine for one and rejected for the other. Apple
  compares against the highest build **ever uploaded** for that platform,
  including builds that were rejected or never released. Check the error message —
  it names the number to beat.

### Notes
- Do **not** merge "Dark Mode" into one word ("DarkMode") to save characters — a
  single token may fail to match the two-word search "dark mode".
- Do not put "accessibility" in the keyword field: it is already in the app name,
  and Apple indexes the name.
- These are starting points; refine them against real store search data once live.
