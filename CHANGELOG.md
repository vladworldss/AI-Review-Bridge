# Changelog

All notable changes to GitLab AI Review Bridge are documented here.
Versions follow the `version` field in [package.json](package.json), which is
what the sidebar header shows.

## [0.4.0] — 2026-08-04

### Turn the sidebar on and off

The sidebar used to appear on every merge request with no way to dismiss it.
Click the extension icon and there is now an **On/Off switch** in the popup.

- Toggling takes effect **immediately, without reloading the page** — in every
  open tab at once.
- The setting is remembered across merge requests, full page loads, and browser
  restarts. Navigating from one MR to another never requires re-enabling it.
- When off, the extension renders nothing **and fetches nothing** — no
  `discussions.json` request is made at all.
- The collapsed/expanded state of the sidebar is now remembered too. Previously
  it reset on every page load.

Because the preference is stored per browser profile rather than per tab,
switching the sidebar off in one tab switches it off everywhere. That is
deliberate for a global on/off.

### No host permissions at all

Chrome Web Store review flagged the broad `host_permissions: https://*/*` added
in 0.3.0. It turned out the extension never needed it: its only network call is
a **same-origin** `fetch` from the content script (the discussions endpoint on
the page you already have open), which requires no host grant, and the packaged
manifest ships no `web_accessible_resources`. So the permission is gone.

- `host_permissions` removed entirely. Reach is now defined solely by the
  content script's match pattern, `https://*/*/-/merge_requests/*`.
- `permissions: ["storage"]` added, for the on/off setting. It holds two
  booleans, locally, and adds no install-time warning of its own.
- The extension can no longer make cross-origin requests or touch any other
  tab's DOM — a real reduction in what it is able to do.

**To be clear about what this does not change:** the install-time "read and
change all your data on all websites" warning **stays**. Chrome derives it from
the union of `host_permissions` and `content_scripts.matches`, and the broad
match pattern has to remain — Chrome allows a wildcard only at the *start* of a
host, so `https://gitlab.*/*` is invalid and corporate hostnames like
`git.acme.internal` cannot be enumerated at build time. The gain is in
capability and in the strength of the review justification, not in the warning.

### Internal

- New `src/shared/storage/preferences.ts` — a dependency-free preferences module
  (defensive parsing, partial-patch writes, `onChanged` subscription filtered by
  key *and* storage area), covered by 28 new unit tests.
- `scripts/build-store-zip.sh` now asserts manifest keys by **set equality**
  instead of filtering. The old guard silently accepted a *missing* key, so it
  could not have detected this regression in either direction; it now fails if
  `host_permissions` reappears, if `permissions` is anything but `["storage"]`,
  or if the match pattern changes.

## [0.3.0] — 2026-07-29

### Works on every GitLab, not just gitlab.com

Until now the published build only ever activated on `gitlab.com`. Self-hosted
instances — how most companies actually run GitLab — required building the
extension yourself with the host baked in via `.env.local`. That made the Store
build useless for the extension's main audience.

The extension now activates on **any** GitLab merge request page, including
corporate self-hosted instances, with no configuration.

- `host_permissions` is now `https://*/*`, and the content script matches
  `https://*/*/-/merge_requests/*`.
- The build-time env substitution (`PLASMO_EXTRA_GITLAB_HOST_PERMISSION`,
  `PLASMO_EXTRA_GITLAB_MR_MATCH`) is gone — no host is compiled in anymore, so
  a private instance can no longer leak into a package.
- The popup now states that any GitLab MR works.

**What this costs, and why it is still narrow.** Chrome now shows "Read and
change all your data on all websites" at install, and Chrome Web Store review
requires a broad-host justification (expect a longer review). Chrome allows
wildcards only at the *start* of a host, so a targeted pattern like
`https://gitlab.*/*` is impossible, and corporate hostnames
(`git.acme.internal`, `code.corp.io`) cannot be enumerated in advance.

In practice the extension stays tightly scoped: it only matches GitLab's
merge-request URL shape (`/-/merge_requests/`), and the sidebar mounts only
when the URL carries a numeric MR id. On any other page it renders nothing and
makes no network request. It still sends data nowhere — the only request is to
`discussions.json` on the host you are already viewing, using your existing
session.

### Store listing assets

- Six 1280×800 listing screenshots, plus 440×280 and 1400×560 promo tiles.
- Refreshed 128×128 listing icon.

### Docs

- Permission justification, privacy policy, audit and publish checklist all
  rewritten for the broad host; a dedicated "Why the extension asks for access
  to all sites" section added to the privacy policy.
- `scripts/build-store-zip.sh` now asserts the manifest contains exactly the
  intended broad patterns and no unsubstituted `$PLASMO_*` literals.

## [0.2.5] — 2026-07-15

- New sidebar color scheme and logo.
- Issue templates and CI workflows.

## [0.2.4] — 2026-07-15

- Extension icon added; toolchain restored after audit-fix downgrade.
- Chrome Web Store release artifacts prepared; self-hosted host moved to
  build-time env.
