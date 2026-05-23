# GitLab AI Review Bridge

Chrome extension MVP that turns GitLab MR review discussions into AI-ready execution tasks for Claude Code, Codex, and VSCode agents.

Stack: TypeScript + React + Plasmo, `chrome.storage.local` for state. See [docs/arch42/](docs/arch42/) for full architecture.

## Project structure

```
chrome_ai_plug/
├── src/
│   ├── background/              service worker (messaging, lifecycle)
│   ├── content/                 content scripts injected into gitlab.com
│   ├── popup/                   browser-action popup (React)
│   ├── options/                 settings page (React)
│   ├── sidepanel/               Chrome Side Panel inbox (React)
│   ├── components/              shared presentational React components
│   ├── hooks/                   shared React hooks
│   ├── lib/                     low-level utilities (clipboard, msg bus)
│   ├── styles/                  global styles
│   ├── contexts/                bounded contexts (DDD)
│   │   ├── gitlab-integration/  parse MR · extract discussions · sync
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── ui/
│   │   ├── task-management/     ReviewTask aggregate · lifecycle
│   │   │   ├── domain/
│   │   │   ├── application/
│   │   │   ├── infrastructure/
│   │   │   └── ui/
│   │   └── ai-dispatch/         PromptEnvelope · clipboard · agents
│   │       ├── domain/
│   │       ├── application/
│   │       ├── infrastructure/
│   │       └── ui/
│   └── shared/
│       ├── types/               cross-context TypeScript types
│       ├── utils/               pure helpers
│       ├── constants/           task states, storage keys, channels
│       └── storage/             chrome.storage.local wrappers
├── assets/
│   ├── icons/                   16/32/48/128 px extension icons
│   └── images/
├── public/                      static files copied to build output
├── tests/
│   ├── unit/                    domain + application
│   ├── integration/             storage, msg bus, parsers
│   ├── e2e/                     Playwright against GitLab fixtures
│   └── fixtures/                MR HTML snapshots
├── docs/
│   └── arch42/                  architecture (arch42 + DDD)
└── .github/workflows/           CI: lint · typecheck · test · build
```

## Layering rules

- `domain/` — pure logic, no browser/React/Plasmo imports.
- `application/` — orchestrates domain via interfaces; no infra imports.
- `infrastructure/` — adapters for `chrome.*` APIs, DOM, clipboard, network.
- `ui/` — React components and hooks specific to one bounded context.
- Cross-context calls go through `application/` use cases, never reach into another context's `domain/` or `infrastructure/`.
