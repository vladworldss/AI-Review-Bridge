# 8. Cross-Cutting Concepts

## Review Task Lifecycle

State machine enforced by `TaskState.canTransition` (see `domain/TaskState.ts`):

```
NEW ───────▶ DISPATCHED ───────▶ IN_PROGRESS
 │  │  │         │  │  │              │  │
 │  │  │         │  │  └──▶ FAILED ◀──┘  │
 │  │  │         │  │          │         │
 │  │  │         │  │          └─▶ DISPATCHED   (retry)
 │  │  │         │  │
 ▼  ▼  ▼         ▼  ▼          ▼         ▼
        RESOLVED  /  IGNORED        (terminal)
```

- From **NEW**: → DISPATCHED, RESOLVED, IGNORED
- From **DISPATCHED**: → IN_PROGRESS, RESOLVED, FAILED, IGNORED
- From **IN_PROGRESS**: → RESOLVED, FAILED, IGNORED
- From **FAILED**: → DISPATCHED (retry), RESOLVED, IGNORED
- **RESOLVED** / **IGNORED**: terminal — no outgoing transitions.

`RESOLVED` is reached automatically during Sync when GitLab reports the source
discussion resolved; `IGNORED` is user-driven.

## Sync Semantics

`InMemoryReviewTaskStore.syncFromDiscussions` is an idempotent upsert run on every
fetch:

- **create** — discussion has a human note and no existing task
- **refresh** — existing task; thread re-derived, new replies pulled in
- **resolve** — GitLab reports the discussion resolved and the task isn't terminal
- **prune** — task exists but GitLab no longer returns its discussion (deleted comment)
- **skip** — discussion has only system notes

A discussion turning `resolvable:false` (common after a rebase) is **not** a prune —
the task is kept; the comment is still feedback.

## Context Window Policy

Prompt envelopes are size-bounded (`ENVELOPE_DEFAULTS`):

- max 10 thread messages (head comment + most recent replies)
- 4 000 chars per comment/message
- 8 000 chars per diff hunk

Over-limit content is clamped with an ellipsis.
