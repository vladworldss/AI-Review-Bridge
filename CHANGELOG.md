# Changelog

All notable changes to GitLab AI Review Bridge are documented here.
Versions follow the `version` field in [package.json](package.json), which is
what the sidebar header shows.

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
