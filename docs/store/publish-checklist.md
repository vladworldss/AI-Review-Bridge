# Pre-publish checklist — Chrome Web Store

Гейт публикации: **Branding** (иконки + скриншоты) + **Development**
(рабочая сборка) + **Privacy Policy** (публичный URL) = **Publish**.

Статусы проставлены по аудиту от 2026-07-15 (v0.2.2, [audit.md](audit.md)).

## Development

- [x] `manifest_version: 3` — подтверждено в `build/chrome-mv3-prod/manifest.json`
- [ ] Версия в манифесте актуальна — перед сабмитом бампнуть `version` в
  `package.json` и пересобрать (правило проекта: бамп на каждую значимую сборку)
- [x] Нет обфускации; source читаем — только штатная минификация Plasmo,
  исходники в публичном репо
- [x] Нет секретов в пакете — grep по `sk-`, `api_key =`, `Bearer `: чисто
  (автопроверка встроена в `scripts/build-store-zip.sh`)
- [x] Нет remote code — весь JS в пакете; grep по `importScripts`/внешним
  `.js` в сборке: чисто (автопроверка в скрипте)
- [x] zip собирается из чистой директории без dev-файлов — скрипт пакует
  только содержимое `build/chrome-mv3-prod/` (`.git`, `node_modules`,
  `tests`, `docs` физически не могут попасть в пакет)
- [x] Команда сборки zip добавлена в README (`./scripts/build-store-zip.sh`)
- [ ] `make check` зелёный на коммите, из которого собран zip
- [ ] Smoke-тест пакета: load unpacked из `build/chrome-mv3-prod`, открыть MR,
  синк + «Send to AI» работают, версия в шапке сайдбара совпадает

## Listing / Review form

- [ ] Все permissions обоснованы в [listing.md](listing.md) — тексты готовы,
  вставить в форму
- [x] Вопрос **B-1** закрыт: self-hosted хост вынесен в `.env.local`
  (build-time env-подстановка); Store-сборка содержит только `gitlab.com` —
  проверить перед упаковкой, что `.env.local` не задан или переименован
- [ ] (после публикации, roadmap) runtime-настройка GitLab-хоста в UI:
  `optional_host_permissions` + `scripting` + options page
- [ ] Single purpose statement вписан (готов в listing.md)
- [ ] Категория Developer Tools, язык English
- [ ] Data Usage Disclosure заполнена по таблице [audit.md](audit.md) §3
  («ничего не собирается/не передаётся», website content — locally only)
- [ ] «Remote code» → No

## Privacy Policy

- [ ] [privacy-policy.md](privacy-policy.md) размещена по публичному URL
- [ ] URL вписан в privacy-policy.md (заменить TODO) и в Store-форму
- [ ] Контакт/URL репозитория в policy и terms заполнены (2 TODO)

## Branding

- [ ] Store icon 128×128 экспортирован (исходник `assets/icon.png` 512×512 есть)
- [ ] Скриншоты 1280×800: минимум S1, лучше S1–S3 из
  [assets-checklist.md](assets-checklist.md)
- [ ] (опц.) Promo tile 440×280

## Юридическое

- [ ] LICENSE создан (предложение: MIT — ждёт подтверждения)
- [ ] [terms.md](terms.md) — вычитаны, TODO заполнены

## Financial disclosure

- [ ] В форме: расширение бесплатное, без покупок (монетизации в коде и
  README нет — подтверждено аудитом)
