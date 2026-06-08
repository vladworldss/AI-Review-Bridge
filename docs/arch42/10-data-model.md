# 10. Data Model

## Task State (in-memory, MVP)

The MVP keeps tasks in an `InMemoryReviewTaskStore` keyed by `discussionId`, rebuilt
from GitLab on each Sync. There is **no** `chrome.storage` persistence yet — in-memory
fields (dispatches, FAILED) survive re-syncs within a page session but reset on reload.

```ts
type ReviewTaskSnapshot = {
  id: string
  mrId: string
  discussionId: string
  commentId: string
  state: 'NEW' | 'DISPATCHED' | 'IN_PROGRESS' | 'RESOLVED' | 'IGNORED' | 'FAILED'
  context: CommentContext
  dispatches: AgentDispatch[]
  createdAt: string
  lastUpdatedAt: string
}
```

## Fetched Discussion (GitLab Integration → Task Management)

Normalized shape produced from `discussions.json`; every field is defensively optional.

```ts
type FetchedDiscussion = {
  discussionId: string
  resolved: boolean
  resolvable: boolean
  filePath: string | null
  line: number | null
  hasDiffContext: boolean
  notes: FetchedNote[]
}

type FetchedNote = {
  noteId: string
  author: string
  body: string
  createdAt: string | null
  isSystem: boolean        // system notes are filtered out of tasks
}
```
