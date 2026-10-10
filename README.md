# Notifier

Сервис уведомлений на базе Bun, TypeScript, Hono и bun:sqlite. Миграции управляются через `bun-sqlite-migrations`.

## Установка и запуск

```bash
bun install
bun run index.ts
```

Тестирование, форматирование и линтинг:

```bash
bun test
bunx oxfmt --check .
bunx oxlint
```

## API

### Providers (`/provider`)

- **`POST /provider`** — создать провайдер (канал отправки уведомлений)
  ```json
  {
    "name": "Telegram Alerts Bot",
    "type": "telegram",
    "options": {
      "token": "bot-token",
      "chat_id": "-1001234567890"
    }
  }
  ```
- **`GET /provider`** — получить список всех провайдеров (поддерживается фильтр по типу: `?type=telegram`)
- **`GET /provider/:id`** — получить провайдер по ID
- **`PUT /provider/:id`** — обновить данные провайдера (`name`, `type`, `options`)
- **`DELETE /provider/:id`** — удалить провайдер

### Templates (`/template`)

- **`POST /template`** — создать шаблон уведомления с привязкой к `provider_id`
  ```json
  {
    "name": "order_shipped",
    "content": "Order #{{order_id}} has been shipped!",
    "provider_id": "<provider-uuid>"
  }
  ```
- **`GET /template`** — список шаблонов (опциональный фильтр: `?provider_id=<id>`)
- **`GET /template/:id`** — получить шаблон по ID
- **`PUT /template/:id`** — обновить шаблон (`name`, `content`, `provider_id`)
- **`DELETE /template/:id`** — удалить шаблон

### Notifications (`/notify`)

- **`POST /notify/:id`** — отправить уведомление по ID шаблона с подстановкой аргументов
  ```json
  {
    "args": {
      "order_id": "42"
    }
  }
  ```
