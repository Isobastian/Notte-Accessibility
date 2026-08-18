# Accessibility Statement

Notte exists **for accessibility**. It was created as a tool for the low-vision
community — the author has a degenerative eye condition — and that mission comes
before everything else.

## Our commitments

- **Free forever.** No ads, no donations, no in-app purchases, no paywalls.
- **No tracking.** No analytics, no telemetry, no data collection of any kind.
- **Minimal permissions.** Only `storage` and `activeTab`.
- **High contrast by design.** Notte's whole purpose is readability.

## What Notte does for readability

Notte darkens overly bright websites by **remapping their colors** in HSL rather
than inverting them. Inversion produces muddy, low-contrast greys; remapping lets
us guarantee a strong text-to-background contrast on every element:

- Light **backgrounds** become dark bands.
- Light **text** becomes bright text.
- **Accent colors** (buttons, badges, selected rows) stay distinct so they still
  read as highlights.
- Hue and saturation are preserved, so pages keep their identity.

The contrast target is **WCAG AA and above**. In testing, text-to-background
contrast averages around 11:1, with the minimum measured around 6:1 — all above
the WCAG AA threshold of 4.5:1 for normal text.

Notte also uses `color-scheme: dark` so native controls (checkboxes, selects,
scrollbars) are themed too, and it leaves images, video and other media in their
natural colors so photos stay recognizable.

## The popup

The popup is designed to be usable by people with low vision: large controls,
readable text, and high contrast.

## Reporting an accessibility problem

If something is hard to read or use, that's a bug we want to hear about. Please
open an issue describing the site, the browser, and what was hard to see or use.
Accessibility reports are the highest priority.
