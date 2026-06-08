# 9. Domain-Driven Design

## Ubiquitous Language

| Term | Meaning |
|---|---|
| **Review Task** | A single actionable unit derived from one GitLab discussion that carries a human comment. The aggregate root. |
| **Discussion** | A GitLab MR thread (`discussions.json` entry). May be resolvable (diff/line comment) or not (general/outdated). One discussion → at most one Review Task. |
| **Note** | A single message inside a discussion. May be human or `system` (e.g. "added 1 commit"). System-only discussions never become tasks. |
| **Comment Context** | The value object snapshotting what an agent needs: file, line, diff hunk, and the human-only message thread. |
| **Prompt Envelope** | The agent-ready payload built from a task's Comment Context. Bounded in size (thread length, char limits). |
| **Dispatch** | The act of sending a task's envelope to an agent (currently: clipboard). Recorded with an outcome. |
| **Agent Target** | Where a dispatch goes (`clipboard`; future: localhost bridge, IDE). |
| **Inbox** | The sidebar list of open Review Tasks on the current MR. |
| **Sync** | An idempotent upsert of the in-memory store from a fresh fetch: create new tasks, refresh threads, resolve, prune. |

## Bounded Contexts & Context Map

```
┌─────────────────────────┐   ParsedDiscussion /   ┌────────────────────────┐
│  GitLab Integration      │   FetchedDiscussion    │  Task Management         │
│  (Supplier)              │ ─────────────────────▶ │  (Customer)              │
│  parse MR · fetch        │                        │  ReviewTask aggregate    │
│  discussions · normalize │                        │  lifecycle · sync · prune│
└─────────────────────────┘                        └───────────┬────────────┘
                                                                │ ReviewTaskSnapshot
                                                                ▼
                                                    ┌────────────────────────┐
                                                    │  AI Dispatch             │
                                                    │  (Customer)              │
                                                    │  PromptEnvelope · render │
                                                    │  · clipboard adapter     │
                                                    └────────────────────────┘
```

Relationship: **Customer/Supplier**, upstream→downstream. Task Management is the core
domain; GitLab Integration and AI Dispatch are supporting. AI Dispatch consumes Task
Management's published language (`ReviewTaskSnapshot`, `AgentTarget`, `CommentContext`)
and never reaches into its internals.

### GitLab Integration Context

Translates GitLab's wire/DOM shapes into clean domain inputs.

- parse MR DOM (fallback) — `extractGitLabDiscussions`, `GitLabDomParser`
- fetch + normalize `discussions.json` (paginated) — `fetchGitLabDiscussions`
- emit `FetchedDiscussion` value objects (resolvable/resolved/notes/position)

### Task Management Context (core)

Owns the `ReviewTask` aggregate and the sync rules.

- create tasks from discussions with a human note
- refresh threads when replies arrive
- drive the lifecycle (dispatch/resolve/ignore/fail)
- prune tasks whose discussion GitLab no longer returns

### AI Dispatch Context

Turns a task snapshot into an agent-ready payload and ships it.

- build a size-bounded `PromptEnvelope`
- render envelope as text
- write to clipboard (`ClipboardPort` → `BrowserClipboardAdapter`)
- record dispatch outcome back on the aggregate

## Aggregate: ReviewTask

Root entity. Identity: `id`. Guards all state transitions and dispatch bookkeeping.

```ts
type ReviewTaskSnapshot = {
  id: string
  mrId: string
  discussionId: string          // links back to the source GitLab discussion
  commentId: string             // first human note (or discussionId fallback)
  state: TaskState
  context: CommentContext       // value object — see below
  dispatches: AgentDispatch[]   // append-only history
  createdAt: string
  lastUpdatedAt: string
}
```

### Value Objects

```ts
type CommentContext = {
  filePath: string
  line: number
  diffHunk: string
  surroundingLines: { before: string[]; after: string[] }
  discussionThread: DiscussionMessage[]   // human notes only
  mrTitle: string
}

type AgentDispatch = {
  id: string
  agent: AgentTarget                       // 'clipboard' | …
  dispatchedAt: string
  outcome: 'PENDING' | 'SUCCESS' | 'FAILED'
  failureReason?: string
}
```

### Invariants

- A discussion becomes a task only if it has **at least one human (non-system) note**.
  `resolvable` is **not** a gate — general comments and rebase-staled diff notes
  (`resolvable:false`) are still real feedback.
- State transitions are validated against the lifecycle matrix; illegal transitions
  throw `IllegalTaskTransitionError`.
- `RESOLVED` and `IGNORED` are terminal — no further transitions, no re-resolve churn.
- `refreshContext` mutates (and bumps `lastUpdatedAt`) only when the thread actually
  changed, keeping idempotent re-syncs side-effect-free.

## Domain Events

Emitted by the aggregate, drained via `pullEvents()`, published through `TaskEventBus`.

| Event | Raised when |
|---|---|
| `ReviewTaskCreated` | a new task is created from a discussion |
| `ReviewTaskDispatched` | a task is dispatched to an agent |
| `ReviewTaskResolved` | GitLab reports the discussion resolved (once) |
| `ReviewTaskIgnored` | the user dismisses a task |
| `DispatchFailed` | a dispatch's clipboard/transport write fails |
