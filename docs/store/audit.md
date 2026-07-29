# Chrome Web Store — аудит расширения (Фаза 0)

Дата аудита: 2026-07-15. Версия: `0.2.2` ([package.json:4](../../package.json)).
Аудит проведён по исходникам `src/` и по фактической prod-сборке
`build/chrome-mv3-prod/manifest.json` (Plasmo генерирует манифест из
`package.json`, ключ `manifest` — [package.json:30-35](../../package.json)).

## 1. Манифест (fact sheet)

Источник: `build/chrome-mv3-prod/manifest.json` (сборка 0.2.2).

| Поле | Значение | Примечание |
|---|---|---|
| `manifest_version` | **3** | ✅ требование Store выполнено |
| `name` | `GitLab AI Review Bridge` | из `package.json.displayName` |
| `version` | `0.2.2` | совпадает с `package.json` |
| `permissions` | **отсутствует** (пусто) | расширение не запрашивает ни одного API-permission |
| `host_permissions` | `https://*/*` (с 0.3.0) | задано в [package.json](../../package.json); широкий хост нужен для self-hosted GitLab, см. §2 и §7 (B-1) |
| `optional_permissions` | отсутствуют | |
| `content_security_policy` | отсутствует (дефолт MV3) | дефолтный CSP MV3 запрещает remote code — соответствует |
| `background.service_worker` | **отсутствует** | фонового скрипта нет вообще; `src/background/` — пустой `.gitkeep` |
| `default_locale` | отсутствует | локализации нет, см. §5 |
| `content_scripts` | 1 скрипт, `matches: https://*/*/-/merge_requests/*`, `run_at: document_idle` | объявлен в [src/contents/gitlab-mr.tsx](../../src/contents/gitlab-mr.tsx) |
| `action.default_popup` | `popup.html` | статическая заглушка [src/popup.tsx](../../src/popup.tsx) |
| `web_accessible_resources` | 1 CSS-файл, для того же match-паттерна | сгенерировано Plasmo для стилей сайдбара |

## 2. Permissions → использование → обоснование

API-permissions (`storage`, `tabs`, `clipboardWrite` и т.д.) **не запрашиваются**.
Единственный используемый `chrome.*` API — `chrome.runtime.getManifest()`
([src/sidebar/Sidebar.tsx:31-37](../../src/sidebar/Sidebar.tsx#L31-L37)), он
permission не требует. Буфер обмена используется через `navigator.clipboard`
из content script — в контексте страницы это не требует `clipboardWrite`
(есть fallback на `document.execCommand('copy')`:
[BrowserClipboardAdapter.ts:77-96](../../src/contexts/ai-dispatch/infrastructure/BrowserClipboardAdapter.ts#L77-L96)).

| Permission | Где используется в коде | Обоснование для формы Store (одной фразой) |
|---|---|---|
| `host_permissions: https://*/*` | content script рендерит сайдбар на страницах MR ([gitlab-mr.tsx](../../src/contents/gitlab-mr.tsx)); fetch `discussions.json` с того же хоста ([fetchGitLabDiscussions.ts:107-111](../../src/lib/fetchGitLabDiscussions.ts#L107-L111)); отдача CSS через `web_accessible_resources` | «GitLab is self-hosted on private corporate domains that cannot be enumerated in the manifest. The script only matches the GitLab-specific `/-/merge_requests/` URL shape and mounts only on a real MR page; elsewhere it does nothing and issues no request.» |
| `storage` | хранение состояния задач по MR в `chrome.storage.local` | «Remembers per-MR task state locally. Never leaves the browser.» |

Почему широкий хост, а не список: Chrome допускает wildcard только в начале
хоста, поэтому паттерн вида `https://gitlab.*/*` невозможен, а корпоративные
инстансы носят произвольные имена (`git.acme.internal`, `code.corp.io`).
Сужение обеспечивается не хостом, а формой пути и guard'ом в
`getRootContainer` (требуется числовой id MR).

Замечание: `matches` в `content_scripts` сами по себе дают инъекцию; отдельный
`host_permissions` нужен Plasmo для `web_accessible_resources.matches` и на
warning-текст при установке не влияет сверх уже объявленных хостов.

## 3. Данные: что собирается, куда передаётся, что хранится

### Сетевые запросы (исчерпывающий список)

Единственный сетевой вызов расширения — `fetch` на
`<тот же GitLab-хост>/.../merge_requests/<iid>/discussions.json`
([fetchGitLabDiscussions.ts:104-141](../../src/lib/fetchGitLabDiscussions.ts#L104-L141)):

- same-origin относительно открытой страницы, `credentials: 'same-origin'` —
  используется существующая сессия пользователя в GitLab, никакие токены/ключи
  расширением не запрашиваются и не хранятся;
- до 3 страниц по `per_page=100`;
- данные никуда дальше не отправляются.

**Запросов к AI-провайдерам нет.** Кнопка «Send to AI» — это копирование
текстового промпта в буфер обмена
([dispatchFromStore.ts:57](../../src/lib/dispatchFromStore.ts#L57),
[dispatchFromStore.ts:70-76](../../src/lib/dispatchFromStore.ts#L70-L76));
единственный `AgentTarget`, используемый в живом коде, — `'clipboard'`
([gitlab-mr.tsx:130](../../src/contents/gitlab-mr.tsx#L130)). Endpoint'ов
OpenAI/Anthropic/прочих в коде нет (проверено grep'ом по `https?://` в `src/`
— все совпадения только про GitLab). Пользователь сам вставляет промпт в свой
AI-инструмент.

Аналитики, телеметрии, трекинга — нет (нет ни одного стороннего endpoint'а
и ни одной аналитической библиотеки в `dependencies`:
[package.json:25-29](../../package.json)).

### Что обрабатывается (в памяти)

Из `discussions.json` извлекаются: id обсуждений, username/имя автора
комментария, текст комментария, дата, путь к файлу и номер строки
([fetchGitLabDiscussions.ts:13-34](../../src/lib/fetchGitLabDiscussions.ts#L13-L34)).
Из DOM читается заголовок MR ([gitlab-mr.tsx:77-85](../../src/contents/gitlab-mr.tsx#L77-L85)).
Это содержит имена пользователей GitLab (персональные данные в терминах
Data Usage Disclosure) — но обрабатывается **только локально**.

### Хранение

**Постоянного хранения нет.** Стор задач — `InMemoryReviewTaskStore`
([reviewTaskMapper.ts:85](../../src/lib/reviewTaskMapper.ts#L85)), живёт в
памяти content script и умирает при закрытии/перезагрузке вкладки.
`chrome.storage`, `localStorage`, `sessionStorage`, `IndexedDB` не
используются нигде в `src/` (проверено grep'ом — 0 совпадений).

### Куда данные «выходят» из расширения

Только в **системный буфер обмена** по явному клику пользователя
(кнопка «Send to AI», [Sidebar.tsx:249-275](../../src/sidebar/Sidebar.tsx#L249-L275)).
Состав копируемого текста: заголовок/id MR, текст комментария и треда,
file:line, diff hunk ([PromptEnvelope.ts:86-107](../../src/contexts/ai-dispatch/domain/PromptEnvelope.ts#L86-L107)).

### Заполнение Data Usage Disclosure (Chrome Web Store)

| Категория формы | Ответ | Основание |
|---|---|---|
| Personally identifiable information | **Не собирается** (username автора комментария обрабатывается в памяти, не передаётся и не хранится) | §3 выше |
| Authentication information | Не собирается (используется существующая cookie-сессия GitLab, расширение её не читает и не хранит) | `credentials: 'same-origin'` |
| Website content | **Обрабатывается локально, не передаётся** (текст обсуждений MR) | §3 выше |
| Все остальные категории (health, financial, location, web history, user activity, communications…) | Не собирается | нет соответствующего кода |
| Продажа данных / передача третьим лицам / использование для кредитоспособности | Нет / Нет / Нет | сетевых передач кроме same-origin GitLab нет |

## 4. Remote hosted code

**Отсутствует.** ✅

- Весь исполняемый JS в пакете: `gitlab-mr.85a5e23d.js`, `popup.100f6462.js`
  (проверен листинг `build/chrome-mv3-prod/`).
- Grep по сборке на `https?://*.js`, `importScripts`, `eval(` — 0 совпадений.
- CSP не переопределён — действует дефолтный MV3, который remote code блокирует.
- Runtime-зависимости только `plasmo`, `react`, `react-dom` — бандлятся локально.

Минификация Plasmo prod-сборки — допустимая (это не обфускация в терминах
политики Store).

Найденный дефект сборки: Plasmo декларирует `gitlab-mr.<hash>.css` в
`web_accessible_resources`, но файл не эмитится — CSS инлайнится в JS через
`data-text:` и внедряется `<style>`-тегом
([gitlab-mr.tsx:44-50](../../src/contents/gitlab-mr.tsx#L44-L50)). Висячая
ссылка в манифесте — риск на автоматическом ревью; `scripts/build-store-zip.sh`
вычищает такие записи при упаковке (функциональность не меняется — файла и
так не было).

## 5. Локализация (`_locales` / `chrome.i18n`)

**Отсутствует** — известное ограничение, сейчас не внедряем:

- каталога `_locales/` нет ни в `src/`, ни в `public/`, ни в сборке;
- `chrome.i18n` в коде не используется (0 совпадений);
- `default_locale` в манифесте нет (корректно: без `_locales` он и не должен
  быть задан, иначе сборка была бы невалидной);
- все UI-строки захардкожены на английском ([Sidebar.tsx](../../src/sidebar/Sidebar.tsx)).

Следствие: язык листинга — английский, один.

## 6. Секреты в коде

Не найдены. Grep по `sk-`, `api_key`, `apiKey`, `Bearer ` по `src/` даёт
только ложные срабатывания на подстроку `task-` (например,
`task-management`). API-ключи расширению не нужны by design (нет запросов к
AI-провайдерам).

## 7. Найденные блокеры / риски ревью Store

- **B-1 — закрыт иначе, чем планировалось (v0.3.0).** Ранее в манифест был
  зашит приватный self-hosted инстанс, затем хост выносился в `.env.local`, и
  Store-сборка поддерживала только `gitlab.com`. Это оставляло корпоративных
  пользователей — основную аудиторию — без работающего расширения. С 0.3.0
  манифест объявляет `host_permissions: https://*/*`, а content script
  матчится по `https://*/*/-/merge_requests/*`; env-подстановка удалена.
  **Цена решения, которую надо учитывать при ревью:** Chrome покажет при
  установке «Read and change all your data on all websites», а Store
  потребует обоснование broad host permissions — текст готов в
  [listing.md](listing.md) и §2 выше. Сужение достигается формой пути и
  guard'ом на числовой id MR, а не списком хостов.
- **B-2 (branding) — закрыт (v0.3.0).** Иконка готова (`assets/icon.png`
  512×512 с альфа-скруглением, v0.2.4), скриншоты 1280×800 (6 шт.) и промо-
  плитки 440×280 / 1400×560 лежат в `docs/store/images/` —
  см. [assets-checklist.md](assets-checklist.md).
- **B-3 — закрыт.** Privacy Policy опубликована в репозитории:
  `https://github.com/vladworldss/AI-Review-Bridge/blob/main/docs/store/privacy-policy.md`.
- **B-4 — закрыт.** `LICENSE` (MIT) добавлен.
- Не-блокер: popup показывает статичную подсказку — single purpose не нарушен.

## 8. Вывод

Технически расширение к ревью готово: MV3, ноль API-permissions, нет remote
code, нет секретов, нет фоновых передач данных. B-1, B-3, B-4 закрыты;
остаются скриншоты (B-2) и действия в кабинете Store — актуальный статус в
[publish-checklist.md](publish-checklist.md).
