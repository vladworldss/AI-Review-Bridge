# 10. Data Model

## Local Storage Schema

```ts
type LocalTaskState = {
  discussionId: string
  commentId: string

  status:
    | 'NEW'
    | 'DISPATCHED'
    | 'IN_PROGRESS'
    | 'RESOLVED'
    | 'IGNORED'

  lastUpdatedAt: string
}
```
