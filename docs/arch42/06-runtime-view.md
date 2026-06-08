# 6. Runtime View

## Sync Discussions (on MR open / refresh / URL change)

```
User opens MR  (content script mounts on /-/merge_requests/<iid>)
  -> fetchGitLabDiscussions(url)
       -> GET discussions.json?per_page=100&page=N   (walk pages, cap 3)
       -> normalizeDiscussions(raw)  ->  FetchedDiscussion[]
  -> store.syncFromDiscussions(mr, discussions)
       -> create / refresh / resolve / prune  (idempotent)
  -> Sidebar renders store.list()  (open shown; resolved behind a toggle)
```

Cross-MR navigation calls `store.clear()` so stale tasks from the previous MR
don't leak into the new one.

## Dispatch to AI

```
User clicks "Send to AI" on a task
  -> dispatchFromStore(store, discussionId, { agent: 'clipboard' })
       -> task.dispatch(agent)                 (NEW/… -> DISPATCHED)
       -> buildPromptEnvelope(snapshot)         (size-bounded)
       -> renderEnvelopeAsText(envelope)
       -> clipboard.write(payload)
       -> markDispatchSucceeded | markDispatchFailed
  -> Sidebar re-renders with the new task state
```

## Resolve Task

```
Developer resolves the thread in GitLab
  -> next Sync sees discussion.resolved = true
  -> task.resolve()                            (-> RESOLVED, terminal)
  -> ReviewTaskResolved emitted once
```
