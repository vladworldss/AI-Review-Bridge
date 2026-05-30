# 9. Domain-Driven Design

## Ubiquitous Language

- Review Task
- Discussion
- Prompt Envelope
- Dispatch
- Inbox
- Context Snippet

## Bounded Contexts

### GitLab Integration Context

- parse MR
- extract discussions
- sync state

### Task Management Context

- create tasks
- manage lifecycle
- track state

### AI Dispatch Context

- build prompts
- send payloads
- track dispatch history

## Aggregate

### ReviewTask

```ts
type ReviewTask = {
  id: string
  mrId: string
  discussionId: string
  commentId: string
  state: TaskState
  context: CommentContext
  dispatches: AgentDispatch[]
}
```

## Domain Events

- ReviewTaskCreated
- ReviewTaskDispatched
- ReviewTaskResolved
- ReviewTaskWithdrawn   # source discussion no longer present in GitLab (e.g. comment deleted)
- DispatchFailed
