# 4. Solution Strategy

## Architectural Principles

### Local First

All state stored locally.

### Human-in-the-loop

AI suggests changes only.

### Minimal Context

Send only:
- review comment
- local diff snippet
- file path
- discussion thread
- MR metadata

### Transport Layer Focus

System acts as context transport layer between GitLab and AI agents.
