# Security Policy

Notte is a browser extension that runs on the pages you visit, so we take
security seriously — even though Notte collects no data and talks to no servers.

## Supported versions

The latest released version of Notte is the one that receives security fixes.
Please make sure you are on the newest version before reporting.

## Reporting a vulnerability

**Please do not report security issues in public GitHub issues.**

Instead, report privately using GitHub's built-in
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability):
go to the **Security** tab of this repository and click **Report a
vulnerability**. This keeps the details private until a fix is available.

When reporting, please include:

- A description of the issue and why it's a concern.
- Steps to reproduce it (a specific website or scenario helps).
- The browser and version affected.

## What to expect

- We will acknowledge your report as soon as we reasonably can.
- We'll work on a fix and keep you updated on progress.
- Once fixed, we'll credit you if you'd like (or keep you anonymous if you
  prefer).

## Scope

Notte requests only `storage` and `activeTab` permissions, performs no network
requests, and collects no data. Reports that respect this design — for example,
ways the content script could be abused by a malicious page — are especially
welcome.

Thank you for helping keep Notte's users safe. 🌙
