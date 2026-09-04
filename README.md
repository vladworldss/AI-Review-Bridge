# GitLab AI Review Bridge

Turn GitLab merge request review discussions into copy-ready AI task prompts — one click per review thread, or all open threads at once, straight to your clipboard.

![Sidebar on a GitLab MR page](docs/store/images/screenshot-sidebar.png)
<!-- TODO: real screenshot; scenarios listed in docs/store/assets-checklist.md -->

## Install

**From Chrome Web Store** (recommended):
<!-- TODO: replace with real listing URL after publication -->
https://chromewebstore.google.com/detail/PLACEHOLDER

**From source (developer mode):**

```bash
npm ci
make build          # production build → build/chrome-mv3-prod
```

Then open `chrome://extensions`, enable **Developer mode**, click **Load
unpacked**, and select `build/chrome-mv3-prod/`. Open any GitLab merge request
— the sidebar appears on the right.

To hide it, click the extension icon and switch **Sidebar** off; the setting is
remembered across merge requests and restarts.

## How it works

- A single **content script** ([src/contents/gitlab-mr.tsx](src/contents/gitlab-mr.tsx))
  runs on GitLab merge request pages and mounts a React **sidebar**
  ([src/sidebar/](src/sidebar/)). There is no background service worker.
- Discussions are fetched from the MR's own `discussions.json` endpoint on the
  same GitLab host, using your existing session
  ([src/lib/fetchGitLabDiscussions.ts](src/lib/fetchGitLabDiscussions.ts)).
- Domain logic lives in three DDD bounded contexts under
  [src/contexts/](src/contexts/): `gitlab-integration` (parse/extract),
  `task-management` (ReviewTask aggregate and lifecycle), `ai-dispatch`
  (PromptEnvelope + clipboard).
- Tasks are kept in an **in-memory store** rebuilt on each sync
  ([src/lib/reviewTaskMapper.ts](src/lib/reviewTaskMapper.ts)) — no review data
  is persisted. The only stored state is the on/off preference
  ([src/shared/storage/preferences.ts](src/shared/storage/preferences.ts)).
- "Send to AI" renders the thread (comment, replies, file:line, diff hunk) as
  a text prompt and **copies it to the clipboard**
  ([src/lib/dispatchFromStore.ts](src/lib/dispatchFromStore.ts)). The
  extension itself never calls any AI provider.
- **"Send all"** copies every open thread as a single payload — one clipboard
  write, tasks separated by a `---` rule under an `# N review tasks` header —
  so a whole review can be pasted into one AI chat. A failed write marks the
  whole batch FAILED rather than leaving part of it claiming success.

Layering rules and the full architecture are documented in
[docs/arch42/](docs/arch42/) and [CLAUDE.md](CLAUDE.md).

## Permissions

The extension requests **no host permissions at all**, and exactly one Chrome API
permission (see [docs/store/audit.md](docs/store/audit.md) for the full audit):

| Permission | Why |
|---|---|
| `storage` | Remember your on/off and collapsed preference — two booleans, local only, never transmitted |

Where the sidebar may appear is defined solely by the content script's match
pattern, `https://*/*/-/merge_requests/*`. It is broad because GitLab is usually
self-hosted on private company domains that cannot be known at build time, and
Chrome permits a wildcard only at the *start* of a host — so `https://gitlab.*/*`
is not a valid pattern. **Self-hosted instances therefore work with no setup.**

The sidebar mounts only when the URL is a real MR with a numeric id; anywhere
else it renders nothing and makes no request. Because there is no host grant, the
extension cannot make cross-origin requests or read any other tab.

Chrome still shows "read and change all your data on all websites" at install —
that warning comes from the match pattern, not from a host permission.

## Privacy

No data leaves your browser: the only network request goes to the GitLab host
you are already viewing, there is no analytics, no AI provider calls, and no
storage. Full policy: [docs/store/privacy-policy.md](docs/store/privacy-policy.md)
· terms: [docs/store/terms.md](docs/store/terms.md).

## Development

```bash
make dev            # Plasmo dev server (watch + HMR)
make check          # typecheck + tests — run before committing
make build          # production build
./scripts/build-store-zip.sh   # Chrome Web Store zip (clean, no dev files)
```

Tests are Vitest: domain/application in `tests/unit/`, parser/flow in
`tests/integration/`. Store submission artifacts live in
[docs/store/](docs/store/).

## License

[MIT](LICENSE)
