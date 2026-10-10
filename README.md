# Notifier

Сервис уведомлений на базе Bun, Hono и bun:sqlite.

## Зачем?

В православном IT только недавно появились аналоги быстрого разветывания
фронтенда как в Vercel. Но до бессерверных функций еще далеко скорее всего.

Если на руках имеется несколько фронтендов, для которых нужно просто
делать уведомления по нажатии кнопки, то почему бы просто не сделать
один хаб для всего этого.

## Чо тут?

Шаблоны поддерживают простые переменные в формате {{variable}}, которые
при рассылке заменяются на необходимые.

Пока что добавил для уведомлений правосланый Telegram, мб потом еще добавлю,
если кому-то надо будет.

А и да, сделано с не-православной нейронкой. Хотя код проверен полностью мной, так что
проблем не должно быть.

## Как использовать?

1. Развертываешь на своем сервере с помощью docker-compose
2. Регистрируешь админа, создаешь Провайдера для конкретного фронтенда, создаешь ему Шаблон
3. Создаешь юзера, получаешь бессрочный JWT токен (при авторизации используй onlyNotify).
4. Пуляешь POST /notify/<id_шаблона> с Authorization: Bearer <токен>.
5. ???
6. Профит. И не надо платить кучу бабок лишь для того, чтобы делать уведомления в тг.

## Установка и запуск

```bash
bun install
bun run index.ts
```

Запуск в Docker:

```bash
cp .env.dev .env
docker compose up -d --build
```

Тестирование, форматирование и линтинг:

```bash
bun test
bunx oxfmt --check .
bunx oxlint
```

## Конфигурация

Все переменные окружения и настройки собраны в объекте `CONFIG` в [`src/config.ts`](src/config.ts):

| Переменная окружения | Поле CONFIG                                     | По умолчанию                  | Описание                           |
| -------------------- | ----------------------------------------------- | ----------------------------- | ---------------------------------- |
| `PORT`               | `CONFIG.port` / `CONFIG.PORT`                   | `3000`                        | Порт HTTP-сервера                  |
| `HOST`               | `CONFIG.host` / `CONFIG.HOST`                   | `0.0.0.0`                     | Хост HTTP-сервера                  |
| `DB_PATH`            | `CONFIG.dbPath` / `CONFIG.DB_PATH`              | `notifier.db`                 | Путь к SQLite БД                   |
| `JWT_SECRET`         | `CONFIG.jwtSecret` / `CONFIG.JWT_SECRET`        | `notifier-default-secret-key` | Секретный ключ для подписи JWT     |
| `JWT_EXPIRES_IN`     | `CONFIG.jwtExpiresIn` / `CONFIG.JWT_EXPIRES_IN` | `3600`                        | Время жизни JWT в секундах (1 час) |
| `NODE_ENV`           | `CONFIG.nodeEnv` / `CONFIG.NODE_ENV`            | `development`                 | Окружение приложения               |

## API

### Auth (`/auth`)

- **`POST /auth/login`** — авторизация пользователя. Возвращает JWT-токен на 1 час. При передаче `"onlyNotify": true` выдает **бессрочный** токен, действующий исключительно для отправки уведомлений (`POST /notify/:id` по разрешенным `template_ids`):
  ```json
  {
    "email": "admin@example.com",
    "password": "secretpassword",
    "onlyNotify": true
  }
  ```
- **`POST /auth/register`** — регистрация нового пользователя (доступна только пользователям с `role == 'admin'` или при первой инициализации системы)
  ```json
  {
    "name": "Service Client",
    "email": "client@example.com",
    "password": "strongpassword",
    "role": "user",
    "template_ids": ["<template-uuid>"]
  }
  ```

### Providers (`/provider`)

_Требуется заголовок `Authorization: Bearer <token>` и `role == 'admin'`._

- **`POST /provider`** — создать провайдер (канал отправки уведомлений)
  ```json
  {
    "name": "Telegram Alerts Bot",
    "type": "telegram",
    "options": {
      "token": "bot-token",
      "chat_id": "-1001234567890",
      "proxy": "http://127.0.0.1:8080"
    }
  }
  ```
- **`GET /provider`** — получить список всех провайдеров (поддерживается фильтр по типу: `?type=telegram`)
- **`GET /provider/:id`** — получить провайдер по ID
- **`PUT /provider/:id`** — обновить данные провайдера (`name`, `type`, `options`)
- **`DELETE /provider/:id`** — удалить провайдер

### Templates (`/template`)

_Требуется заголовок `Authorization: Bearer <token>` и `role == 'admin'`._

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

_Требуется заголовок `Authorization: Bearer <token>`. Идентификатор шаблона `:id` обязательно должен присутствовать в `template_ids` авторизованного пользователя._

- **`POST /notify/:id`** — отправить уведомление по ID шаблона с подстановкой аргументов
  ```json
  {
    "args": {
      "order_id": "42"
    }
  }
  ```
