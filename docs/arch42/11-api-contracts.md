# 11. API Contracts

## Dispatch Payload

```json
{
  "taskId": "task-001",
  "mr": {
    "id": "123",
    "title": "Refactor auth middleware"
  },
  "review": {
    "comment": "Potential race condition here"
  },
  "context": {
    "file": "auth/service.ts",
    "line": 182
  }
}
```
