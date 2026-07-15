# Chrome Web Store Listing — GitLab AI Review Bridge

Все утверждения сверены с кодом — см. [audit.md](audit.md).

## Название (≤ 45 символов)

```
GitLab AI Review Bridge: MR Comments to AI
```

42 символа. Содержит поисковые запросы «GitLab», «AI review», «MR comments».
(Запасной короткий вариант — текущее имя из манифеста, 23 символа:
`GitLab AI Review Bridge`.)

> Примечание: имя в листинге должно совпадать с `name` в манифесте. Если
> берём длинный вариант — обновить `displayName` в
> [package.json:3](../../package.json) перед сборкой.

## Short description (≤ 132 символа)

```
Turn GitLab merge request review comments into copy-ready AI prompts — one click per thread, nothing leaves your browser.
```

121 символ.

## Detailed description

```
Turn GitLab merge request review discussions into AI-ready task prompts in one
click. Instead of hand-copying a reviewer's comment, the file path, the line
number and the diff into your AI assistant, get a ready-made prompt on your
clipboard and paste it into Claude Code, Codex, Cursor — any tool you use.

WHAT IT DOES
• Adds a sidebar to every GitLab merge request page listing all review
  discussions as tasks
• Shows open vs resolved counts; resolved threads can be hidden or shown
• Each task shows the reviewer, comment preview, reply count and file:line
• "Send to AI" copies a structured prompt — MR title, the full comment
  thread, file and line, and the diff hunk — to your clipboard
• Fetches ALL discussions (paginated), so comments added after a rebase
  don't get lost
• Skips system notes ("added 1 commit…") — only real human feedback becomes
  a task
• Re-syncs when you navigate between MRs; a refresh button re-fetches on
  demand

PRIVACY FIRST
The extension talks only to the GitLab page you are already on, using your
existing session. No AI provider is ever called — "Send to AI" is a clipboard
copy, and you choose where to paste it. No analytics, no external servers, no
data stored: tasks live in memory and disappear when the tab closes. No API
keys needed or accepted.

Requires no Chrome permissions beyond access to GitLab merge request pages.
```

Каждый пункт списка соответствует коду: сайдбар и счётчики —
`src/sidebar/Sidebar.tsx`; состав промпта —
`src/contexts/ai-dispatch/domain/PromptEnvelope.ts`; пагинация —
`src/lib/fetchGitLabDiscussions.ts`; фильтр system-notes и open/resolved —
`src/lib/reviewTaskMapper.ts`; ре-синк по навигации —
`src/contents/gitlab-mr.tsx`.

## Single purpose statement (для формы ревью)

```
Display GitLab merge request review discussions as a task list and copy each
discussion to the clipboard as an AI-ready prompt.
```

## Permission justifications (для формы ревью)

Перенесено из [audit.md](audit.md) §2. API-permissions не запрашиваются.

| Permission | Justification |
|---|---|
| Host: `https://gitlab.com/*` | Needed to display the review-task sidebar on GitLab merge request pages and read that MR's discussion data from GitLab itself. No data is sent anywhere. |

Это единственный хост в Store-сборке: self-hosted инстансы подключаются
только в локальных сборках через `.env.local` (см. audit.md §2) и в
Store-форме не фигурируют.

## Категория и язык

- **Category:** Developer Tools (в новой таксономии Store: Tools → Developer Tools)
- **Language:** English (единственный — UI не локализован, см. audit.md §5)

## Прочие поля формы

- **Privacy policy URL:** TODO — см. [privacy-policy.md](privacy-policy.md)
- **Data usage disclosure:** заполнять по таблице в [audit.md](audit.md) §3
  (ничего не собирается/не передаётся)
- **Remote code:** No
