# Pre-publish checklist — Chrome Web Store

Гейт публикации: **Branding** (иконки + скриншоты) + **Development**
(рабочая сборка) + **Privacy Policy** (публичный URL) = **Publish**.

Статусы актуализированы 2026-07-15 (v0.2.4). Репозиторий:
https://github.com/vladworldss/AI-Review-Bridge

## Development

- [x] `manifest_version: 3` — подтверждено в `build/chrome-mv3-prod/manifest.json`
- [x] Версия в манифесте актуальна — 0.2.4 (иконка); при новых изменениях
  перед сабмитом бампнуть снова
- [x] Нет обфускации; source читаем — только штатная минификация Plasmo,
  исходники в публичном репо
- [x] Нет секретов в пакете — grep по `sk-`, `api_key =`, `Bearer `: чисто
  (автопроверка встроена в `scripts/build-store-zip.sh`)
- [x] Нет remote code — весь JS в пакете (автопроверка в скрипте)
- [x] zip собирается из чистой директории без dev-файлов; `.env*` на время
  сборки откладываются — self-hosted хост физически не может попасть в пакет
  (guard: только `https://gitlab.com/*` в манифесте)
- [x] Команда сборки zip добавлена в README (`./scripts/build-store-zip.sh`)
- [x] `make check` зелёный (126 тестов) на текущем состоянии; повторить на
  финальном коммите перед упаковкой
- [ ] **Smoke-тест пакета**: load unpacked из `build/chrome-mv3-prod`, открыть
  MR, синк + «Send to AI» работают, версия в шапке сайдбара = 0.2.4
- [ ] Финальный `./scripts/build-store-zip.sh` с коммита, который уйдёт в
  Store (текущий: `dist/gitlab-ai-review-bridge-v0.2.4.zip`)

## Listing / Review form (заполняется в кабинете Store)

- [x] Все permissions обоснованы в [listing.md](listing.md) — тексты готовы
- [x] Вопрос **B-1** закрыт: self-hosted хост вынесен в `.env.local`;
  Store-сборка содержит только `gitlab.com`
- [ ] Single purpose statement вписан в форму (готов в listing.md)
- [ ] Категория Developer Tools, язык English
- [ ] Data Usage Disclosure заполнена по таблице [audit.md](audit.md) §3
  («ничего не собирается/не передаётся», website content — locally only)
- [ ] «Remote code» → No
- [ ] Имя в листинге = `name` в манифесте (сейчас `GitLab AI Review Bridge`;
  длинный вариант из listing.md — опция, тогда обновить `displayName` и
  пересобрать)
- [ ] (после публикации, roadmap) runtime-настройка GitLab-хоста в UI

## Privacy Policy

- [x] Policy публикуется в репозитории; URL вписан в policy и listing.md:
  `https://github.com/vladworldss/AI-Review-Bridge/blob/main/docs/store/privacy-policy.md`
- [ ] После push проверить, что URL открывается в приватном окне (репо публичный)
- [ ] URL вписан в Store-форму

## Branding

- [x] Иконка: `assets/icon.png` 512×512 с альфа-скруглением; Plasmo
  генерирует 16–128; для формы листинга — `docs/store/images/icon-128.png`
- [ ] **Скриншоты 1280×800**: минимум S1, лучше S1–S3 из
  [assets-checklist.md](assets-checklist.md)
- [ ] (опц.) Promo tile 440×280
- [ ] Риск: тануки GitLab в иконке — товарный знак; при отказе ревью
  заменить на абстрактный элемент

## Юридическое

- [x] LICENSE создан (MIT)
- [x] [terms.md](terms.md) — TODO заполнены (контакт + issues URL)

## Financial disclosure

- [ ] В форме: расширение бесплатное, без покупок (монетизации нет —
  подтверждено аудитом)
