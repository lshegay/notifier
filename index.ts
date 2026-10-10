import { createDatabase } from './src/database/database';
import { SqliteProviderRepository } from './src/repository/sqlite-provider.repository';
import { SqliteTemplateRepository } from './src/repository/sqlite-template.repository';
import { NotifyTelegramRepository } from './src/repository/notify.telegram.repository';
import { ProviderUsecase } from './src/usecase/provider.usecase';
import { TemplateUsecase } from './src/usecase/template.usecase';
import { NotifyUsecase } from './src/usecase/notify.usecase';
import { ProviderHandler } from './src/delivery/http/handlers/provider.handler';
import { TemplateHandler } from './src/delivery/http/handlers/template.handler';
import { NotifyHandler } from './src/delivery/http/handlers/notify.handler';
import { createHonoApp } from './src/delivery/http/app';
import { startServer } from './src/delivery/http/server';

// 1. Database & Migrations
const db = createDatabase();

// 2. Repository layer
const providerRepository = new SqliteProviderRepository(db);
const templateRepository = new SqliteTemplateRepository(db);
const telegramRepository = new NotifyTelegramRepository();

// 3. Use case layer
const providerUsecase = new ProviderUsecase(providerRepository);
const templateUsecase = new TemplateUsecase(templateRepository, providerRepository);
const notifyUsecase = new NotifyUsecase(
  templateRepository,
  providerRepository,
  telegramRepository
);

// 4. Delivery / HTTP layer (Hono handlers)
const providerHandler = new ProviderHandler(providerUsecase);
const templateHandler = new TemplateHandler(templateUsecase);
const notifyHandler = new NotifyHandler(notifyUsecase);

// 5. Create Hono application
const app = createHonoApp({
  providerHandler,
  templateHandler,
  notifyHandler,
});

// 6. Start HTTP server
const port = Number(process.env.PORT) || 3000;
const server = startServer(app, { port });

console.log(`🚀 Notifier server (Hono) is running on http://${server.hostname}:${server.port}`);
