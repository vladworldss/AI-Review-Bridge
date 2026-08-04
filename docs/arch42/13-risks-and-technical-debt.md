# 13. Risks and Technical Debt

## Risks

- GitLab DOM changes
- Oversized prompts
- Duplicate tasks
- Clipboard UX limitations

## Known technical debt

- **Content script mounts once, cannot unmount.** `src/contents/gitlab-mr.tsx`
  exports no anchor getter, so Plasmo builds no anchor observer and calls
  `render()` a single time at `document_idle`. Two consequences: the on/off
  preference must be handled by returning `null` from `Content()` rather than by
  gating `getRootContainer` (see [CLAUDE.md](../../CLAUDE.md)), and a URL that
  matches the pattern without a numeric MR id (`/-/merge_requests/new`) leaves
  the extension inert for that document even after an SPA navigation to a real
  MR. Exporting `getOverlayAnchor` would fix both and provide a real unmount
  path, but it changes the mount model — separate change.
- **Overlapping syncs are not cancelled.** Rapid SPA navigation can leave two
  `sync()` calls in flight with no ordering guarantee; the last write wins
  ([gitlab-mr.tsx](../../src/contents/gitlab-mr.tsx)). Pre-existing, not
  observed in practice, would need a generation counter or an AbortController.
- **Install warning cannot be narrowed.** The broad `content_scripts.matches`
  needed for self-hosted GitLab makes Chrome show "access to all sites"
  regardless of host permissions. Removing it requires the
  `optional_host_permissions` + `chrome.scripting` path in
  [16-roadmap.md](16-roadmap.md), with per-host onboarding.

## Deferred Complexity

- semantic rebasing
- patch auto-application
- backend sync
- team collaboration
