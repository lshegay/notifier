import { createDatabase } from './src/database/database';
import { SqliteProviderRepository } from './src/repository/sqlite-provider.repository';
import { SqliteTemplateRepository } from './src/repository/sqlite-template.repository';
import { SqliteUserRepository } from './src/repository/sqlite-user.repository';
import { NotifyTelegramRepository } from './src/repository/notify.telegram.repository';
import { ProviderUsecase } from './src/usecase/provider.usecase';
import { TemplateUsecase } from './src/usecase/template.usecase';
import { NotifyUsecase } from './src/usecase/notify.usecase';
import { AuthUsecase } from './src/usecase/auth.usecase';
import { QuickRegisterUsecase } from './src/usecase/quick-register.usecase';
import { ProviderHandler } from './src/delivery/http/handlers/provider.handler';
import { TemplateHandler } from './src/delivery/http/handlers/template.handler';
import { NotifyHandler } from './src/delivery/http/handlers/notify.handler';
import { AuthHandler } from './src/delivery/http/handlers/auth.handler';
import { QuickRegisterHandler } from './src/delivery/http/handlers/quick-register.handler';
import { createHonoApp } from './src/delivery/http/app';
import { startServer } from './src/delivery/http/server';
import { CONFIG } from './src/config';

// 1. Database & Migrations
const db = createDatabase({ dbPath: CONFIG.dbPath });

// 2. Repository layer
const providerRepository = new SqliteProviderRepository(db);
const templateRepository = new SqliteTemplateRepository(db);
const userRepository = new SqliteUserRepository(db);
const telegramRepository = new NotifyTelegramRepository();

// 3. Use case layer
const providerUsecase = new ProviderUsecase(providerRepository);
const templateUsecase = new TemplateUsecase(templateRepository, providerRepository);
const notifyUsecase = new NotifyUsecase(templateRepository, providerRepository, telegramRepository);
const authUsecase = new AuthUsecase(userRepository, {
  jwtSecret: CONFIG.jwtSecret,
  tokenExpiresInSeconds: CONFIG.jwtExpiresIn,
});
const quickRegisterUsecase = new QuickRegisterUsecase(
  providerUsecase,
  templateUsecase,
  authUsecase
);

// 4. Delivery / HTTP layer (Hono handlers)
const providerHandler = new ProviderHandler(providerUsecase);
const templateHandler = new TemplateHandler(templateUsecase);
const notifyHandler = new NotifyHandler(notifyUsecase);
const authHandler = new AuthHandler(authUsecase);
const quickRegisterHandler = new QuickRegisterHandler(quickRegisterUsecase);

// 5. Create Hono application
const app = createHonoApp({
  providerHandler,
  templateHandler,
  notifyHandler,
  authHandler,
  quickRegisterHandler,
  authUsecase,
  userRepo: userRepository,
  providerRepo: providerRepository,
  templateRepo: templateRepository,
  pathPrefix: CONFIG.pathPrefix,
});

// 6. Start HTTP server
const server = startServer(app, {
  port: CONFIG.port,
  hostname: CONFIG.host,
});

const prefixInfo = CONFIG.pathPrefix ? ` with prefix '${CONFIG.pathPrefix}'` : '';
console.log(
  `🚀 Notifier server (Hono) is running on http://${server.hostname}:${server.port}${prefixInfo}`
);
