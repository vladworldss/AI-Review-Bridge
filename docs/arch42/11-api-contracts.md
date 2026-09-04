# 11. API Contracts

## GitLab: `discussions.json` (consumed)

`GET <mr-url>/discussions.json?per_page=100&page=N`

Headers: `Accept: application/json`, `X-Requested-With: XMLHttpRequest`,
`cache: no-store`, `credentials: same-origin`.

Behaviour observed on the self-hosted instance (drives the fetch design):

- **Paginated.** Default `per_page=20`; the full set only arrives if you raise
  `per_page` and/or walk pages. Without paging, newer threads (e.g. comments added
  after a rebase) silently fall off the first page.
- **No pagination headers.** `X-Next-Page` / `Link` are absent, so the fetch loop
  stops when a page returns fewer than `per_page` rows (short-page = last page).
- **Ordering:** oldest → newest. Open threads tend to sit at the tail, so the page
  budget must be generous (currently `per_page=100`, up to 3 pages = 300 discussions).
- Relevant per-note fields: `id`, `system`, `resolvable`, `resolved`, `note`,
  `note_html`, `author`, `created_at`, `position.{new_path,old_path,new_line,old_line}`.

## Dispatch Payload (produced)

Rendered text payload (see `renderEnvelopeAsText`); the underlying `PromptEnvelope`:

```json
{
  "taskId": "task-001",
  "agent": "clipboard",
  "mr": { "id": "47", "title": "CP-1465. instantbox check router" },
  "review": {
    "comment": "Potential race condition here",
    "thread": [{ "author": "egor.bunakov", "body": "agreed, needs masking" }]
  },
  "context": { "file": "app/db/repositories/history_repo.py", "line": 84, "diffHunk": "…" },
  "generatedAt": "2026-06-08T12:00:00.000Z"
}
```

### Rendered text shape

`renderEnvelopeAsText(envelope)` emits, in order: `# Review task <id>`, `MR:`,
`File:`, `## Review comment`, `## Thread` (only when there are replies), and
`## Diff hunk` fenced in triple backticks.

Two sections are conditional, because a general (non-diff) discussion has
neither and an empty heading is pure noise multiplied across a batch:

- `## Diff hunk` is **omitted** when `context.diffHunk` is blank.
- `File:` degrades to `File: (general discussion, no diff context)` when
  `context.file` is empty (instead of a bare `File: :0`).

`renderEnvelopesAsText(envelopes)` (used by "Send all") concatenates several
rendered envelopes into one clipboard payload:

- empty input → `''`; a single envelope → byte-identical to
  `renderEnvelopeAsText`, with no batch header;
- two or more → `# N review tasks` header, then each envelope separated by a
  `\n\n---\n\n` rule (no rule directly after the header).
