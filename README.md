# Notifier

[English](#english) | [Русский](#русский)

---

## English

A lightweight notification hub service built with **Bun**, **Hono**, and **bun:sqlite**.

### Why?

Modern frontend deployments are quick and effortless, but spinning up serverless functions or backend infrastructure just to send notifications can be an unnecessary hassle.

If you have multiple frontends, websites, or services that simply need to send event-driven notifications (like button clicks, form submissions, or system alerts), Notifier serves as a single, self-hosted hub for all of them.

### Features

- **Templates with Variable Interpolation**: Use `{{variable}}` syntax in templates, replaced dynamically upon notification dispatch.
- **Provider System**: Extensible notification channels. Built-in support for **Telegram** (via GramIO) with bot token, chat ID, and proxy configuration.
- **Role-Based Access & JWT Auth**:
  - `admin` role: Manage providers, templates, and users.
  - `onlyNotify` tokens: Issue indefinite API tokens restricted strictly to sending notifications for specific allowed `template_ids`.
- **Fast SQLite Storage**: Native `bun:sqlite` with automated migrations (`bun-sqlite-migrations`) and WAL mode for reliability and performance.
- **Docker Ready**: Pre-configured `Dockerfile` and `docker-compose.yaml` using the official `oven/bun:1` image.

### Quick Start

#### Local Development

```bash
bun install
bun run index.ts
```

#### Docker Compose

```bash
cp .env.dev .env
docker compose up -d --build
```

#### Testing & Quality Checks

```bash
bun test
bunx oxfmt --check .
bunx oxlint
```

### Configuration

All settings are centralized in the `CONFIG` object in [`src/config.ts`](src/config.ts) and configured via environment variables:

| Environment Variable | CONFIG Field                                    | Default                       | Description                              |
| -------------------- | ----------------------------------------------- | ----------------------------- | ---------------------------------------- |
| `PORT`               | `CONFIG.port` / `CONFIG.PORT`                   | `3000`                        | HTTP server port                         |
| `HOST`               | `CONFIG.host` / `CONFIG.HOST`                   | `0.0.0.0`                     | HTTP server host binding                 |
| `DB_PATH`            | `CONFIG.dbPath` / `CONFIG.DB_PATH`              | `data/notifier.db`            | Path to SQLite database file             |
| `JWT_SECRET`         | `CONFIG.jwtSecret` / `CONFIG.JWT_SECRET`        | `notifier-default-secret-key` | Secret key used for signing JWTs         |
| `JWT_EXPIRES_IN`     | `CONFIG.jwtExpiresIn` / `CONFIG.JWT_EXPIRES_IN` | `3600`                        | JWT token expiration in seconds (1 hour) |
| `NODE_ENV`           | `CONFIG.nodeEnv` / `CONFIG.NODE_ENV`            | `development`                 | Application environment mode             |
| `PATH_PREFIX`        | `CONFIG.pathPrefix` / `CONFIG.PATH_PREFIX`      | `""` (empty)                  | Optional path prefix for all endpoints   |

### How It Works

1. Deploy the service on your server using Docker Compose.
2. Log in as an admin, create a Provider (e.g. Telegram channel/bot), and link it to a Template.
3. Register a user/client with access to the template and obtain an indefinite JWT token (`onlyNotify: true`).
4. Trigger `POST /notify/<template_id>` with `Authorization: Bearer <token>` and your payload arguments.
5. Notification is rendered and dispatched instantly.

### API Reference

> [!NOTE]
> If `PATH_PREFIX` is configured (e.g. `/api`), all endpoints are mounted under that path (e.g. `POST /api/notify/:id`, `GET /api/provider`).

#### Authentication (`/auth`)

- **`POST /auth/login`** — Authenticate and receive a JWT token (expires in 1 hour). When `"onlyNotify": true` is provided, returns an **indefinite** token restricted strictly to sending notifications (`POST /notify/:id`) for the user's assigned `template_ids`:
  ```json
  {
    "email": "admin@example.com",
    "password": "secretpassword",
    "onlyNotify": true
  }
  ```
- **`POST /auth/register`** — Register a new user (restricted to `role == 'admin'`):
  ```json
  {
    "name": "Service Client",
    "email": "client@example.com",
    "password": "strongpassword",
    "role": "user",
    "template_ids": ["<template-uuid>"]
  }
  ```

#### Quick Register (`/quick-register`)

_Requires `Authorization: Bearer <token>` and `role == 'admin'`._

- **`POST /quick-register`** — One-step setup for instant notification dispatch. Automatically creates a provider named `<name>-<template_type>`, a template named `<name>-<template_type>`, a user with randomized credentials, and returns an indefinite `onlyNotify` JWT token together with the template ID:
  ```json
  {
    "name": "order_alerts",
    "content": "Order #{{order_id}} status: {{status}}",
    "template_type": "telegram",
    "options": {
      "token": "bot-token",
      "chat_id": "-1001234567890",
      "proxy": "http://127.0.0.1:8080"
    },
    "origins": ["https://my-frontend.com", "http://localhost:3000"]
  }
  ```
  Response (`201 Created`):
  ```json
  {
    "jwt_token": "eyJhbGciOi...",
    "template_id": "3c90c3ae-...",
    "id": "3c90c3ae-..."
  }
  ```
  _(The `options` and `origins` fields are optional; default placeholder values are used if omitted)._

#### Providers (`/provider`)

_Requires `Authorization: Bearer <token>` and `role == 'admin'`._

- **`POST /provider`** — Create a notification channel provider (specify `origins` to allow browser CORS requests to `/notify`):
  ```json
  {
    "name": "Telegram Alerts Bot",
    "type": "telegram",
    "options": {
      "token": "bot-token",
      "chat_id": "-1001234567890",
      "proxy": "http://127.0.0.1:8080"
    },
    "origins": ["https://my-frontend.com", "http://localhost:3000"]
  }
  ```
- **`GET /provider`** — List all providers (filter by type: `?type=telegram`).
- **`GET /provider/:id`** — Get provider by ID.
- **`PUT /provider/:id`** — Update provider (`name`, `type`, `options`, `origins`).
- **`DELETE /provider/:id`** — Delete provider.

#### Templates (`/template`)

_Requires `Authorization: Bearer <token>` and `role == 'admin'`._

- **`POST /template`** — Create a message template linked to `provider_id`:
  ```json
  {
    "name": "order_shipped",
    "content": "Order #{{order_id}} has been shipped!",
    "provider_id": "<provider-uuid>"
  }
  ```
- **`GET /template`** — List all templates (optional filter: `?provider_id=<id>`).
- **`GET /template/:id`** — Get template by ID.
- **`PUT /template/:id`** — Update template (`name`, `content`, `provider_id`).
- **`DELETE /template/:id`** — Delete template.

#### Notifications (`/notify`)

_Requires `Authorization: Bearer <token>`. The template `:id` must be present in the authenticated user's `template_ids`._
_CORS enabled: Browser requests (`Origin` header and preflight `OPTIONS`) are validated against the `origins` configured in the template's provider (use `"*"` to allow all)._

- **`POST /notify/:id`** — Send notification by template ID with argument substitution:
  ```json
  {
    "args": {
      "order_id": "42"
    }
  }
  ```

---

## Русский

Сервис уведомлений на базе Bun, Hono и bun:sqlite.

### Зачем?

В православном IT только недавно появились аналоги быстрого разветывания
фронтенда как в Vercel. Но до бессерверных функций еще далеко скорее всего.

Если на руках имеется несколько фронтендов, для которых нужно просто
делать уведомления по нажатии кнопки, то почему бы просто не сделать
один хаб для всего этого.

### Чо тут?

Шаблоны поддерживают простые переменные в формате {{variable}}, которые
при рассылке заменяются на необходимые.

Пока что добавил для уведомлений правосланый Telegram, мб потом еще добавлю,
если кому-то надо будет.

А и да, сделано с не-православной нейронкой. Хотя код проверен полностью мной, так что
проблем не должно быть.

### Как использовать?

1. Развертываешь на своем сервере с помощью docker-compose
2. Регистрируешь админа, создаешь Провайдера для конкретного фронтенда, создаешь ему Шаблон
3. Создаешь юзера, получаешь бессрочный JWT токен (при авторизации используй onlyNotify).
4. Пуляешь POST /notify/<id_шаблона> с Authorization: Bearer <токен>.
5. ???
6. Профит. И не надо платить кучу бабок лишь для того, чтобы делать уведомления в тг.

### Установка и запуск

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

### Конфигурация

Все переменные окружения и настройки собраны в объекте `CONFIG` в [`src/config.ts`](src/config.ts):

| Переменная окружения | Поле CONFIG                                     | По умолчанию                  | Описание                           |
| -------------------- | ----------------------------------------------- | ----------------------------- | ---------------------------------- |
| `PORT`               | `CONFIG.port` / `CONFIG.PORT`                   | `3000`                        | Порт HTTP-сервера                  |
| `HOST`               | `CONFIG.host` / `CONFIG.HOST`                   | `0.0.0.0`                     | Хост HTTP-сервера                  |
| `DB_PATH`            | `CONFIG.dbPath` / `CONFIG.DB_PATH`              | `data/notifier.db`            | Путь к SQLite БД                   |
| `JWT_SECRET`         | `CONFIG.jwtSecret` / `CONFIG.JWT_SECRET`        | `notifier-default-secret-key` | Секретный ключ для подписи JWT     |
| `JWT_EXPIRES_IN`     | `CONFIG.jwtExpiresIn` / `CONFIG.JWT_EXPIRES_IN` | `3600`                        | Время жизни JWT в секундах (1 час) |
| `NODE_ENV`           | `CONFIG.nodeEnv` / `CONFIG.NODE_ENV`            | `development`                 | Окружение приложения               |
| `PATH_PREFIX`        | `CONFIG.pathPrefix` / `CONFIG.PATH_PREFIX`      | `""` (пусто)                  | Опциональный префикс пути ручек    |

### API

> [!NOTE]
> Если задан `PATH_PREFIX` (например, `/api`), все ручки приложения монтируются с этим префиксом (например, `POST /api/notify/:id`, `GET /api/provider`).

#### Auth (`/auth`)

- **`POST /auth/login`** — авторизация пользователя. Возвращает JWT-токен на 1 час. При передаче `"onlyNotify": true` выдает **бессрочный** токен, действующий исключительно для отправки уведомлений (`POST /notify/:id` по разрешенным `template_ids`):
  ```json
  {
    "email": "admin@example.com",
    "password": "secretpassword",
    "onlyNotify": true
  }
  ```
- **`POST /auth/register`** — регистрация нового пользователя (доступна только пользователям с `role == 'admin'`):
  ```json
  {
    "name": "Service Client",
    "email": "client@example.com",
    "password": "strongpassword",
    "role": "user",
    "template_ids": ["<template-uuid>"]
  }
  ```

#### Быстрая регистрация (`/quick-register`)

_Требуется заголовок `Authorization: Bearer <token>` и `role == 'admin'`._

- **`POST /quick-register`** — Быстрое создание всего необходимого в один запрос. Создает провайдер с именем `<name>-<template_type>`, шаблон с текстом сообщения и именем `<name>-<template_type>`, пользователя со случайными данными (логин, email, пароль), авторизует его с флагом `onlyNotify` и сразу возвращает бессрочный `jwt_token` и `template_id` для отправки уведомлений:
  ```json
  {
    "name": "order_alerts",
    "content": "Order #{{order_id}} status: {{status}}",
    "template_type": "telegram",
    "options": {
      "token": "bot-token",
      "chat_id": "-1001234567890",
      "proxy": "http://127.0.0.1:8080"
    },
    "origins": ["https://my-frontend.com", "http://localhost:3000"]
  }
  ```
  Ответ (`201 Created`):
  ```json
  {
    "jwt_token": "eyJhbGciOi...",
    "template_id": "3c90c3ae-...",
    "id": "3c90c3ae-..."
  }
  ```
  _(Параметры `options` и `origins` опциональны — если не переданы, подставляются значения по умолчанию)._

#### Providers (`/provider`)

_Требуется заголовок `Authorization: Bearer <token>` и `role == 'admin'`._

- **`POST /provider`** — создать провайдер (канал отправки уведомлений; укажите `origins` для разрешения CORS-запросов из браузера к `/notify`):
  ```json
  {
    "name": "Telegram Alerts Bot",
    "type": "telegram",
    "options": {
      "token": "bot-token",
      "chat_id": "-1001234567890",
      "proxy": "http://127.0.0.1:8080"
    },
    "origins": ["https://my-frontend.com", "http://localhost:3000"]
  }
  ```
- **`GET /provider`** — получить список всех провайдеров (поддерживается фильтр по типу: `?type=telegram`)
- **`GET /provider/:id`** — получить провайдер по ID
- **`PUT /provider/:id`** — обновить данные провайдера (`name`, `type`, `options`, `origins`)
- **`DELETE /provider/:id`** — удалить провайдер

#### Templates (`/template`)

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

#### Notifications (`/notify`)

_Требуется заголовок `Authorization: Bearer <token>`. Идентификатор шаблона `:id` обязательно должен присутствовать в `template_ids` авторизованного пользователя._
_Включена поддержка CORS: браузерные запросы (заголовок `Origin` и preflight-запросы `OPTIONS`) валидируются по списку `origins` провайдера, привязанного к шаблону (используйте `"*"` для разрешения любых доменов)._

- **`POST /notify/:id`** — отправить уведомление по ID шаблона с подстановкой аргументов
  ```json
  {
    "args": {
      "order_id": "42"
    }
  }
  ```
