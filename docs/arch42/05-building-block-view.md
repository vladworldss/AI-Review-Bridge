# 5. Building Block View

## Main Components

### Chrome Extension (content script + sidebar)

Responsibilities:
- fetch & normalize `discussions.json` (DOM parsing is a fallback)
- extract discussions → build review tasks
- sync the in-memory store (create/refresh/resolve/prune)
- generate prompts (PromptEnvelope)
- render the inbox sidebar

### AI Dispatch Layer

Responsibilities:
- clipboard dispatch
- localhost bridge (future)
- IDE integration (future)

### AI Coding Agent

Examples:
- Claude Code
- Codex Agent
- VSCode Agent
