# Contributing to Notte

Thank you for wanting to help! 🌙 Notte is a free accessibility tool for the
low-vision community, and every bug report, idea and fix makes it better for
people who really need it.

Notte will always be **free, open source, ad-free and tracking-free**. Please
keep that spirit in mind when contributing.

## Ways to help

You don't need to be a programmer to help:

- **Report a bug** — found a website that doesn't darken correctly, flashes, or
  looks wrong? Open an issue and tell us the site and what you saw.
- **Suggest an improvement** — an accessibility idea, a readability tweak, a site
  that needs special handling.
- **Improve the docs** — fix a typo, clarify a step, translate something.
- **Write code** — fix a bug or add a feature (see below).

## Reporting a bug

Open a new issue and include, as much as you can:

- The **browser** and version (Chrome, Firefox, or Safari on iPhone/iPad/Mac).
- The **website** where it happens (a public URL helps a lot).
- **What you expected** vs. **what actually happened** (a screenshot is gold).
- Whether the per-site switch was on or off for that site.

## The golden rule for code changes

Notte is **one codebase for three browsers**. The shared files
(`content.js`, `shadow-patch.js`, `popup.html`, `popup.js`, `images/`) are
identical in `chrome/`, `firefox/` and `safari/` — only each `manifest.json`
differs.

**Edit the shared files in `chrome/` only, then run `bash tools/sync.sh`** to
copy them into `firefox/` and `safari/`. Never edit the same shared file in
three places by hand.

## Design principles (please respect these)

- **Free & unmonetized.** No "Donate" buttons, no in-app purchases, no ads, no
  analytics, no data collection.
- **Accessibility first.** Large controls, readable text, high contrast in the
  popup. Always think of people with low vision.
- **Minimal permissions.** Only `storage` and `activeTab`. Don't add permissions
  that would alarm users or the stores.
- **Guaranteed contrast.** Dark backgrounds with light text at a high contrast
  ratio (WCAG). No muddy greys.
- **Color remapping, not inversion.** The engine remaps colors in HSL; it does
  **not** use `filter: invert()`. Please don't reintroduce inversion — it gave
  unreadable greys and broke on complex web apps.

## Before you open a pull request

- Load the extension unpacked and test on **at least one bright site and one
  site that has its own dark mode**.
- If you touched shared files, confirm you ran `tools/sync.sh`.
- Quick sanity checks:
  ```bash
  node --check chrome/content.js && node --check chrome/popup.js
  python3 -c "import json;json.load(open('chrome/manifest.json'))"
  ```
- Keep changes focused and describe what you changed and why.

## Working across two machines (Mac + Windows)

This repo includes a `.gitattributes` file that normalizes line endings, so you
can safely edit on either machine and sync with GitHub Desktop without Git
flagging whole files as "changed" just because of invisible line-ending
differences.

## Questions

Not sure about something? Open an issue and ask — friendly questions are
welcome.
