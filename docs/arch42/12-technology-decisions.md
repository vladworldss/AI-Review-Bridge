# 12. Technology Decisions

## MVP Stack

Frontend:
- TypeScript
- React
- Plasmo

Storage:
- in-memory store (`InMemoryReviewTaskStore`), rebuilt from GitLab per Sync
- `chrome.storage.local` persistence — planned, not yet wired

Future:
- Go daemon
- MCP integration
- tree-sitter
