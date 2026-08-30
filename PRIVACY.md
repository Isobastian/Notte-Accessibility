# Privacy Policy — Notte — Accessibility & Dark Mode

**Effective date:** 30 August 2026
**Applies to:** the Notte browser extension and its container app on Safari
(iPhone, iPad, Mac), Chrome and Firefox.

## The short version

**Notte collects no data. None.** There is no server, no account, no analytics,
no advertising, no tracking, and no third-party SDK of any kind. Nothing you do
in your browser is recorded, transmitted or shared, by us or by anyone else.

## What Notte stores, and where

Notte stores only your own settings: which sites you have switched it on or off
for, and the per-site tool values (contrast, brightness, saturation, warm tint,
dim images, text size, letter and word spacing, line spacing, font, links,
motion, focus).

These are written to your browser's local extension storage (`storage.local`) on
the device you are using. They stay on that device. They are not uploaded, not
synced to us, and not readable by us or by any website. Removing the extension
removes them.

## What Notte does on the network

Notte contacts no server of its own, because it has none.

It makes exactly one kind of network request, and only while you are loading a
page you are already visiting: re-downloading a stylesheet that the page itself
has already loaded. This is needed because a browser extension cannot read the
contents of a stylesheet served from another domain, and Notte must read a
page's colours in order to remap them. The request goes to the same address the
page already used, is sent without cookies or credentials
(`credentials: "omit"`), and the result is used in memory to recolour the page
and then discarded. Nothing is logged and nothing is sent anywhere else.

Bundled resources — including the OpenDyslexic font — ship inside the extension,
so no content is fetched from any CDN or third party.

## Permissions, and why each one exists

- **`storage`** — to remember your per-site settings on your device.
- **`activeTab`** — so the popup knows which site you are on, to apply settings
  to that site.
- **Access to websites (`host_permissions`)** — so Notte can read and restyle the
  pages you open, and so the stylesheet re-fetch described above can work. This
  access is used for recolouring only. Notte does not read your page content,
  form fields, passwords, browsing history or personal information, and has no
  mechanism to transmit them.

## Children

Notte collects no data from anyone, of any age.

## Your rights

There is no data to access, correct, export or delete, because none is
collected. Your settings are yours, on your device, and you can clear them at any
time by removing the extension.

## Changes

If this policy ever changes, the revised version will be published here with a
new effective date. Notte's commitment not to collect data is a project
principle, not a current configuration.

## Verifying any of this

Notte is open source. The entire extension — including the service worker that
performs the stylesheet re-fetch — can be read at
<https://github.com/Isobastian/Notte-Accessibility>. There is no build step and
no minified code: the files that ship are the files in the repository.

## Contact

sebastian.nicosia@icloud.com
