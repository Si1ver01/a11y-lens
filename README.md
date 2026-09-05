# a11y-lens

> Локальное browser extension для проверки accessibility текущей страницы.

## TL;DR

`a11y-lens` — локальное browser extension для проверки accessibility текущей страницы. Проект собирает Manifest V3 extension для Chromium и Firefox и закладывает безопасный runtime injection, versioned messaging и границы для диагностик.

## Features

- Сборка Manifest V3 для Chromium и Firefox.
- Runtime injection content script через `activeTab` и `scripting` без широких host permissions.
- Версионированный messaging protocol с лимитами размера и валидацией команд.
- Redacted logger с production-уровнем `SILENT` по умолчанию.
- Автоматические проверки manifest, extension package и production dependencies.
- Основа для accessibility-категорий: headings, landmarks, accessible names, contrast и focus order.

## Installation

```bash
npm install
```

## Usage

Запустите dev-сборку для Chromium:

```bash
npm run dev
```

Для Firefox используйте отдельную команду:

```bash
npm run dev:firefox
```

Перед проверкой изменений запустите typecheck и security gates:

```bash
npm run typecheck
npm run security:check
npm run manifest:check
npm run extension:check
```

Требования: Node.js `>=24.18.0` и npm `>=11.16.0`.

## Architecture / Stack

- `WXT` и TypeScript управляют сборкой cross-browser extension.
- `React` и `ReactDOM` реализуют popup UI.
- `axe-core` и `dom-accessibility-api` используются как основа accessibility-диагностик.
- `entrypoints/` содержит popup и content script entrypoints.
- `src/messaging/` содержит protocol schema, client и server.
- `src/platform/` содержит browser capability checks и injection.
- `src/diagnostics/` содержит типизированное redacted logging.
- `.output/` содержит собранные browser packages и не коммитится.

## Documentation

| Документ                 | Описание                               |
| ------------------------ | -------------------------------------- |
| [`README.md`](README.md) | Установка, запуск и устройство проекта |

Лицензия: MIT.
