# Pre-publish checklist — Chrome Web Store

Гейт публикации: **Branding** (иконки + скриншоты) + **Development**
(рабочая сборка) + **Privacy Policy** (публичный URL) = **Publish**.

Статусы актуализированы 2026-08-10 (v0.5.0). Репозиторий:
https://github.com/vladworldss/AI-Review-Bridge

## Development

- [x] `manifest_version: 3` — подтверждено в `build/chrome-mv3-prod/manifest.json`
- [x] Версия в манифесте актуальна — 0.5.0 (host_permissions удалён, добавлен
  `storage`); при новых изменениях перед сабмитом бампнуть снова
- [x] Нет обфускации; source читаем — только штатная минификация Plasmo,
  исходники в публичном репо
- [x] Нет секретов в пакете — grep по `sk-`, `api_key =`, `Bearer `: чисто
  (автопроверка встроена в `scripts/build-store-zip.sh`)
- [x] Нет remote code — весь JS в пакете (автопроверка в скрипте)
- [x] zip собирается из чистой директории без dev-файлов; env-подстановка
  хоста удалена в 0.3.0 — приватные инстансы физически не могут попасть
  в манифест (guard: `host_permissions` отсутствует, `permissions` = `['storage']`,
  `matches` строго `https://*/*/-/merge_requests/*` — проверка set-equality)
- [x] Guard проверен негативно: возврат `host_permissions`, добавление `tabs`,
  удаление `storage` и расширение `matches` — каждый случай валит сборку
- [x] Команда сборки zip добавлена в README (`./scripts/build-store-zip.sh`)
- [x] `make check` зелёный (154 теста) на текущем состоянии; повторить на
  финальном коммите перед упаковкой
- [ ] **Smoke-тест пакета**: load unpacked из `build/chrome-mv3-prod`, открыть
  MR, синк + «Send to AI» + «Send all» работают, версия в шапке сайдбара = 0.5.0
- [ ] **Smoke-тест переключателя (0.4.0)**: popup → Off убирает сайдбар без
  перезагрузки; On возвращает и пересинхронизирует; переход на другой MR
  (SPA-ссылкой и полной загрузкой) не требует повторного включения; при Off в
  DevTools Network нет запроса `discussions.json`
- [ ] Финальный `./scripts/build-store-zip.sh` с коммита, который уйдёт в
  Store (текущий: `dist/gitlab-ai-review-bridge-v0.5.0.zip`)

## Listing / Review form (заполняется в кабинете Store)

- [x] Все permissions обоснованы в [listing.md](listing.md) — тексты готовы
- [x] Вопрос **B-1** закрыт: с 0.4.0 `host_permissions` удалён вовсе (право не
  использовалось — fetch same-origin), охват задаёт только
  `content_scripts.matches`, нужный для self-hosted GitLab
- [ ] **Broad host justification** вписан в форму ревью — текст готов в
  [listing.md](listing.md). Учесть: предупреждение об «access to all sites»
  остаётся, его даёт `matches`; в обосновании упирать на то, что host-прав нет
- [ ] `storage` обоснован в форме (две булевы настройки UI, локально) —
  текст в [listing.md](listing.md)
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
