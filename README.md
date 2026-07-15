# GitLab AI Review Bridge

Turn GitLab merge request review discussions into copy-ready AI task prompts — one click per review thread, straight to your clipboard.

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
  ([src/lib/reviewTaskMapper.ts](src/lib/reviewTaskMapper.ts)) — nothing is
  persisted.
- "Send to AI" renders the thread (comment, replies, file:line, diff hunk) as
  a text prompt and **copies it to the clipboard**
  ([src/lib/dispatchFromStore.ts](src/lib/dispatchFromStore.ts)). The
  extension itself never calls any AI provider.

Layering rules and the full architecture are documented in
[docs/arch42/](docs/arch42/) and [CLAUDE.md](CLAUDE.md).

## Permissions

The extension requests **no Chrome API permissions** — only host access
(see [docs/store/audit.md](docs/store/audit.md) for the full audit):

| Host permission | Why |
|---|---|
| `https://gitlab.com/*` | Show the sidebar on MR pages and read that MR's discussions from GitLab itself |

**Self-hosted GitLab:** copy [.env.example](.env.example) to `.env.local`, set
your instance's URL patterns, and `make build` — the host is substituted into
the manifest at build time and never enters the repository or the Store build.
(Runtime host configuration via the options UI is on the roadmap.)

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

MIT (proposed — `LICENSE` file pending maintainer confirmation, see
[docs/store/audit.md](docs/store/audit.md) §7).
