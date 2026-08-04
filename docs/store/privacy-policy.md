# Privacy Policy — GitLab AI Review Bridge

_Last updated: 2026-08-04. Applies to extension version 0.4.0._

Public URL of this policy (use in the Chrome Web Store listing form):
`https://github.com/vladworldss/AI-Review-Bridge/blob/main/docs/store/privacy-policy.md`

GitLab AI Review Bridge ("the extension") turns GitLab merge request review
discussions into copy-ready AI task prompts. It runs entirely inside your
browser. This policy describes exactly what data the extension touches, based
on its source code (references below point to files in the public repository).

## What data the extension processes

When you open a merge request page on `gitlab.com` or on any self-hosted
GitLab instance, the extension:

- Fetches that merge request's review discussions from **the same GitLab host
  you are already viewing**, via the endpoint
  `/-/merge_requests/<id>/discussions.json`
  (`src/lib/fetchGitLabDiscussions.ts`). The request uses your existing GitLab
  browser session (`credentials: 'same-origin'`); the extension never asks
  for, reads, or stores any password, token, or API key.
- Reads the merge request title from the open page
  (`src/contents/gitlab-mr.tsx`).

The fetched data includes discussion IDs, comment authors' GitLab usernames,
comment text, timestamps, and file/line references.

## Why the extension asks for access to all sites

Chrome shows a broad "read and change all your data on all websites" warning at
install. As of version 0.4.0 the extension holds **no host permissions at all** —
the warning comes from the content script's *match pattern*, which is what tells
Chrome where the sidebar may be injected. GitLab is most often self-hosted on
private company domains (`git.acme.internal`, `code.corp.io`), which cannot be
listed in the manifest ahead of time, and Chrome allows a wildcard only at the
start of a host, so a pattern like `https://gitlab.*/*` is not valid.

Because there is no host grant, the extension **cannot** make cross-origin
requests and cannot read or modify any other browser tab. Its single request is
same-origin, to the GitLab page you already have open.

In practice the extension is far narrower than that permission suggests: it
only activates on URLs matching GitLab's merge-request shape
(`/-/merge_requests/<number>`), and on any other page it mounts nothing and
makes no network request. It never sends data anywhere regardless of the site
you are on.

## Where data is sent

**Nowhere.** The extension makes no network requests other than the
same-origin GitLab request described above. In particular:

- **No AI provider endpoints.** The extension does not call OpenAI, Anthropic,
  Google, or any other AI service. The "Send to AI" button only copies a
  plain-text prompt to your system clipboard
  (`src/lib/dispatchFromStore.ts`, `src/contexts/ai-dispatch/`). You decide
  where to paste it.
- **No analytics or telemetry.** There is no tracking code and no third-party
  analytics library in the extension.
- **No developer servers.** The developer operates no backend and receives no
  data from the extension.

## What is stored locally

**No review data is persisted.** Review tasks live in an in-memory store inside
the merge request tab (`InMemoryReviewTaskStore`, `src/lib/reviewTaskMapper.ts`)
and are discarded when the tab is closed or reloaded. The extension does not use
`localStorage`, `sessionStorage`, or IndexedDB.

The one thing saved (since 0.4.0) is **your own UI preference**, in
`chrome.storage.local` under a single key `grb:preferences`:

```json
{ "enabled": true, "collapsed": false }
```

Two on/off booleans — whether the sidebar is shown, and whether it is collapsed.
No merge request content, no usernames, no identifiers of any kind. It is never
transmitted anywhere, and nothing is written until you actually use the toggle,
so if you never open the popup the extension stores nothing at all.

## Clipboard

Data leaves the extension only when **you click "Send to AI"**: the selected
discussion (MR title, comment thread, file/line, diff hunk) is copied to your
clipboard as text. What happens to the clipboard contents afterwards is under
your control.

## What is NOT collected

The extension does not collect, transmit, sell, or share: personally
identifiable information, authentication data, financial or health
information, location, browsing history, or user activity metrics. It has no
account system and no server side.

## Data retention

Zero. No data outlives the browser tab it was loaded in, and no data is ever
transmitted off the GitLab host it came from (except to your clipboard, at
your explicit request).

## Changes to this policy

Changes will be published at the same public URL and reflected in the
"Last updated" date above.

## Contact

Questions about this policy: `gerasimenkovladimirzz@gmail.com`
(or open an issue at https://github.com/vladworldss/AI-Review-Bridge/issues).
