import { describe, expect, it } from 'bun:test';
import { createDatabase } from '../src/database/database';
import { SqliteProviderRepository } from '../src/repository/sqlite-provider.repository';
import { SqliteTemplateRepository } from '../src/repository/sqlite-template.repository';
import { SqliteUserRepository } from '../src/repository/sqlite-user.repository';
import { NotifyTelegramRepository } from '../src/repository/notify.telegram.repository';
import { ProviderUsecase } from '../src/usecase/provider.usecase';
import { TemplateUsecase } from '../src/usecase/template.usecase';
import { NotifyUsecase } from '../src/usecase/notify.usecase';
import { AuthUsecase } from '../src/usecase/auth.usecase';
import { ProviderHandler } from '../src/delivery/http/handlers/provider.handler';
import { TemplateHandler } from '../src/delivery/http/handlers/template.handler';
import { NotifyHandler } from '../src/delivery/http/handlers/notify.handler';
import { AuthHandler } from '../src/delivery/http/handlers/auth.handler';
import { NotificationType, renderTemplate } from '../src/domain/notification';
import { type TelegramProviderOptions, validateTelegramOptions } from '../src/domain/provider';
import type { TelegramNotificationRepository } from '../src/usecase/notify.telegram.repository';
import { createHonoApp } from '../src/delivery/http/app';
import { CONFIG } from '../src/config';

async function createTestApp(customTelegramRepo?: TelegramNotificationRepository) {
  const db = createDatabase({ dbPath: ':memory:' });
  const providerRepo = new SqliteProviderRepository(db);
  const templateRepo = new SqliteTemplateRepository(db);
  const userRepo = new SqliteUserRepository(db);
  const sentTelegramMessages: Array<{ options: TelegramProviderOptions; text: string }> = [];

  const telegramRepo: TelegramNotificationRepository = customTelegramRepo ?? {
    sendMessage: async (options, text) => {
      sentTelegramMessages.push({ options, text });
    },
  };

  const providerUsecase = new ProviderUsecase(providerRepo);
  const templateUsecase = new TemplateUsecase(templateRepo, providerRepo);
  const notifyUsecase = new NotifyUsecase(templateRepo, providerRepo, telegramRepo);
  const authUsecase = new AuthUsecase(userRepo, {
    jwtSecret: CONFIG.jwtSecret,
    tokenExpiresInSeconds: CONFIG.jwtExpiresIn,
  });

  const providerHandler = new ProviderHandler(providerUsecase);
  const templateHandler = new TemplateHandler(templateUsecase);
  const notifyHandler = new NotifyHandler(notifyUsecase);
  const authHandler = new AuthHandler(authUsecase);

  const app = createHonoApp({
    providerHandler,
    templateHandler,
    notifyHandler,
    authHandler,
    authUsecase,
    userRepo,
  });

  // Create default admin for test operations
  const adminPassword = 'admin-password-123';
  const hashedPassword = await Bun.password.hash(adminPassword);
  const adminUser = await userRepo.create({
    name: 'Initial Admin',
    email: 'admin@example.com',
    password: hashedPassword,
    role: 'admin',
    template_ids: [],
  });

  const { token: adminToken } = await authUsecase.login('admin@example.com', adminPassword);

  return {
    app,
    db,
    providerRepo,
    templateRepo,
    userRepo,
    authUsecase,
    telegramRepo,
    sentTelegramMessages,
    adminUser,
    adminToken,
    adminPassword,
  };
}

describe('Notifier Application with Providers, Templates, Telegram Dispatcher, and JWT Auth', () => {
  it('creates, reads, updates, and deletes providers via HTTP with admin authorization', async () => {
    const { app, adminToken } = await createTestApp();

    // 1. Create provider (POST /provider)
    const createRes = await app.request('/provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Telegram Alerts Bot',
        type: 'telegram',
        options: {
          token: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
          chat_id: '-1001234567890',
          proxy: 'http://127.0.0.1:8080',
        },
      }),
    });

    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      id: string;
      name: string;
      type: string;
      options: Record<string, unknown>;
    };
    expect(created.id).toBeDefined();
    expect(created.name).toBe('Telegram Alerts Bot');
    expect(created.type).toBe('telegram');
    expect(created.options.chat_id).toBe('-1001234567890');
    expect(created.options.proxy).toBe('http://127.0.0.1:8080');

    const providerId = created.id;

    // 2. Get provider by ID (GET /provider/:id)
    const getRes = await app.request(`/provider/${providerId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as { id: string; name: string; type: string };
    expect(fetched.id).toBe(providerId);
    expect(fetched.name).toBe('Telegram Alerts Bot');
    expect(fetched.type).toBe('telegram');

    // 3. Update provider (PUT /provider/:id)
    const updateRes = await app.request(`/provider/${providerId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Telegram Alerts Bot Updated',
        options: {
          token: 'updated-token',
          chat_id: '-1001234567890',
        },
      }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as {
      id: string;
      name: string;
      options: Record<string, unknown>;
    };
    expect(updated.name).toBe('Telegram Alerts Bot Updated');
    expect(updated.options.token).toBe('updated-token');

    // 4. Delete provider (DELETE /provider/:id)
    const deleteRes = await app.request(`/provider/${providerId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(deleteRes.status).toBe(200);

    // 5. Verify deleted provider returns 404
    const getDeletedRes = await app.request(`/provider/${providerId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getDeletedRes.status).toBe(404);
  });

  it('supports multiple providers per type and filtering by type', async () => {
    const { app, adminToken } = await createTestApp();

    // Create 3 telegram providers
    await app.request('/provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Telegram Support Bot',
        type: 'telegram',
        options: { token: 'token-1', chat_id: 'support_chat' },
      }),
    });

    await app.request('/provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Telegram Billing Bot',
        type: 'telegram',
        options: { token: 'token-2', chat_id: 'billing_chat' },
      }),
    });

    await app.request('/provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Telegram Alerts Bot',
        type: 'telegram',
        options: { token: 'token-3', chat_id: 'alerts_chat' },
      }),
    });

    // List all providers
    const allRes = await app.request('/provider', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(allRes.status).toBe(200);
    const allProviders = (await allRes.json()) as Array<{ id: string; type: string }>;
    expect(allProviders.length).toBe(3);

    // List only telegram providers
    const tgRes = await app.request('/provider?type=telegram', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(tgRes.status).toBe(200);
    const tgProviders = (await tgRes.json()) as Array<{ id: string; type: string }>;
    expect(tgProviders.length).toBe(3);
    expect(tgProviders.every((p) => p.type === 'telegram')).toBe(true);

    // Filter by type with no matching providers
    const emptyRes = await app.request('/provider?type=other', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(emptyRes.status).toBe(200);
    const emptyProviders = (await emptyRes.json()) as Array<{ id: string; type: string }>;
    expect(emptyProviders.length).toBe(0);
  });

  it('creates, reads, updates, and deletes templates with provider_id via HTTP', async () => {
    const { app, adminToken } = await createTestApp();

    // 1. Create a provider first
    const providerRes = await app.request('/provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Main Telegram Channel',
        type: 'telegram',
        options: { token: 'token-main', chat_id: '@my_channel' },
      }),
    });
    const provider = (await providerRes.json()) as { id: string };

    // 2. Create template with provider_id (POST /template)
    const createRes = await app.request('/template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'welcome_email',
        content: 'Hello, {{name}}! Welcome to {{service}}.',
        provider_id: provider.id,
      }),
    });

    expect(createRes.status).toBe(201);
    const created = (await createRes.json()) as {
      id: string;
      name: string;
      content: string;
      provider_id: string;
    };
    expect(created.id).toBeDefined();
    expect(created.name).toBe('welcome_email');
    expect(created.content).toBe('Hello, {{name}}! Welcome to {{service}}.');
    expect(created.provider_id).toBe(provider.id);

    const templateId = created.id;

    // 3. Get template by ID (GET /template/:id)
    const getRes = await app.request(`/template/${templateId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as {
      id: string;
      name: string;
      content: string;
      provider_id: string;
    };
    expect(fetched.id).toBe(templateId);
    expect(fetched.name).toBe('welcome_email');
    expect(fetched.provider_id).toBe(provider.id);

    // 4. Update template (PUT /template/:id)
    const updateRes = await app.request(`/template/${templateId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        content: 'Hi {{name}}! Welcome to {{service}} updated.',
      }),
    });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as {
      id: string;
      content: string;
      provider_id: string;
    };
    expect(updated.content).toBe('Hi {{name}}! Welcome to {{service}} updated.');
    expect(updated.provider_id).toBe(provider.id);

    // 5. Delete template (DELETE /template/:id)
    const deleteRes = await app.request(`/template/${templateId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(deleteRes.status).toBe(200);

    // 6. Verify deleted template returns 404
    const getDeletedRes = await app.request(`/template/${templateId}`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(getDeletedRes.status).toBe(404);
  });

  it('authenticates with JWT, authorizes register for admin, and enforces template_ids on notify', async () => {
    const { app, adminToken, authUsecase, userRepo } = await createTestApp();

    // 1. Create provider and template as admin
    const provRes = await app.request('/provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Order Telegram Bot',
        type: 'telegram',
        options: { token: 'bot-token-123', chat_id: '12345' },
      }),
    });
    const prov = (await provRes.json()) as { id: string };

    const createTplRes = await app.request('/template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'order_status',
        content: 'Order #{{order_id}} for {{customer_name}} is now {{status}}.',
        provider_id: prov.id,
      }),
    });
    const template = (await createTplRes.json()) as { id: string };

    // 2. Register a regular user with access to this template via admin
    const registerRes = await app.request('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Regular Client',
        email: 'client@example.com',
        password: 'password123',
        role: 'user',
        template_ids: [template.id],
      }),
    });
    expect(registerRes.status).toBe(201);
    const registeredUser = (await registerRes.json()) as {
      id: string;
      email: string;
      role: string;
    };
    expect(registeredUser.email).toBe('client@example.com');
    expect(registeredUser.role).toBe('user');

    // 3. Login as regular user to get JWT token
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'client@example.com',
        password: 'password123',
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as { token: string };
    expect(loginBody.token).toBeDefined();

    // Verify token expiration is approximately 1 hour (3600 seconds)
    const tokenPayload = await authUsecase.verifyToken(loginBody.token);
    const nowSeconds = Math.floor(Date.now() / 1000);
    expect(tokenPayload.exp - nowSeconds).toBeGreaterThanOrEqual(3590);
    expect(tokenPayload.exp - nowSeconds).toBeLessThanOrEqual(3605);

    const clientToken = loginBody.token;

    // 4. Regular user CANNOT access /template or /provider (requires admin role -> 403)
    const regularTplRes = await app.request('/template', {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    expect(regularTplRes.status).toBe(403);

    const regularProvRes = await app.request('/provider', {
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    expect(regularProvRes.status).toBe(403);

    // 5. Regular user CANNOT register another user (requires admin role -> 403)
    const regularRegRes = await app.request('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        name: 'Hacker',
        email: 'hacker@example.com',
        password: 'password123',
      }),
    });
    expect(regularRegRes.status).toBe(403);

    // 6. Regular user CAN call POST /notify/:id because template.id is in their template_ids
    const notifyRes = await app.request(`/notify/${template.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${clientToken}`,
      },
      body: JSON.stringify({
        args: {
          order_id: '9981',
          customer_name: 'Alice',
          status: 'SHIPPED',
        },
      }),
    });
    expect(notifyRes.status).toBe(200);
    const notifyBody = (await notifyRes.json()) as {
      success: boolean;
      data: { renderedContent: string; providerId: string; templateId: string };
    };
    expect(notifyBody.success).toBe(true);
    expect(notifyBody.data.renderedContent).toBe('Order #9981 for Alice is now SHIPPED.');

    // 7. Register another user WITHOUT access to this template
    const otherUserHashedPassword = await Bun.password.hash('password123');
    await userRepo.create({
      name: 'Unprivileged User',
      email: 'unprivileged@example.com',
      password: otherUserHashedPassword,
      role: 'user',
      template_ids: ['other-unrelated-template-id'],
    });

    const unprivilegedLogin = await authUsecase.login('unprivileged@example.com', 'password123');

    // Calling /notify/:id without template_id in template_ids returns 403 Forbidden
    const forbiddenNotify = await app.request(`/notify/${template.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${unprivilegedLogin.token}`,
      },
      body: JSON.stringify({
        args: { order_id: '1' },
      }),
    });
    expect(forbiddenNotify.status).toBe(403);

    // 8. Calling without Authorization header returns 401 Unauthorized
    const unauthNotify = await app.request(`/notify/${template.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        args: { order_id: '1' },
      }),
    });
    expect(unauthNotify.status).toBe(401);
  });

  it('validates request inputs with Zod and returns 400 Bad Request', async () => {
    const { app, adminToken, userRepo, authUsecase } = await createTestApp();

    // 1. Missing name in POST /provider
    const missingProvName = await app.request('/provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ type: 'telegram', options: { token: 't', chat_id: '1' } }),
    });
    expect(missingProvName.status).toBe(400);

    // 2. Missing type in POST /provider
    const missingProvType = await app.request('/provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: 'tg_bot' }),
    });
    expect(missingProvType.status).toBe(400);

    // 3. Invalid type in POST /provider (not in NotificationType enum)
    const invalidTypeRes = await app.request('/provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: 'email_provider', type: 'email' }),
    });
    expect(invalidTypeRes.status).toBe(400);
    const invalidTypeBody = (await invalidTypeRes.json()) as { error?: string };
    expect(invalidTypeBody.error).toContain('Invalid provider type');

    // 4. Missing token in Telegram options
    const missingTokenRes = await app.request('/provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: 'tg_bot', type: 'telegram', options: { chat_id: '123' } }),
    });
    expect(missingTokenRes.status).toBe(400);

    // 5. Missing chat_id in Telegram options
    const missingChatIdRes = await app.request('/provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: 'tg_bot', type: 'telegram', options: { token: 'my_tok' } }),
    });
    expect(missingChatIdRes.status).toBe(400);

    // 6. Invalid proxy URL in Telegram options
    const invalidProxyRes = await app.request('/provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'tg_bot',
        type: 'telegram',
        options: { token: 'my_tok', chat_id: '123', proxy: 'not-a-valid-url' },
      }),
    });
    expect(invalidProxyRes.status).toBe(400);

    // 7. Empty body in PUT /provider/:id
    const emptyProvPut = await app.request('/provider/123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({}),
    });
    expect(emptyProvPut.status).toBe(400);

    // 8. Invalid type in PUT /provider/:id (not in NotificationType enum)
    const invalidPutTypeRes = await app.request('/provider/123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ type: 'whatsapp' }),
    });
    expect(invalidPutTypeRes.status).toBe(400);

    // 9. Missing provider_id in POST /template
    const missingProviderIdRes = await app.request('/template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: 'welcome', content: 'hello' }),
    });
    expect(missingProviderIdRes.status).toBe(400);

    // 10. Non-existent provider_id in POST /template returns 404
    const notFoundProviderRes = await app.request('/template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'welcome',
        content: 'hello',
        provider_id: 'non-existent-provider',
      }),
    });
    expect(notFoundProviderRes.status).toBe(404);

    // 11. Missing name in POST /template
    const missingNameRes = await app.request('/template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ content: 'some text', provider_id: 'p1' }),
    });
    expect(missingNameRes.status).toBe(400);

    // 12. PUT /template/:id with empty body
    const emptyPutRes = await app.request('/template/123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({}),
    });
    expect(emptyPutRes.status).toBe(400);

    // 13. POST /notify/:id with missing args
    // First create a user that has access to template 123
    const userHashedPassword = await Bun.password.hash('testpass');
    await userRepo.create({
      name: 'Test',
      email: 'test@example.com',
      password: userHashedPassword,
      role: 'user',
      template_ids: ['123'],
    });
    const { token: userToken } = await authUsecase.login('test@example.com', 'testpass');

    const missingArgsRes = await app.request('/notify/123', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({}),
    });
    expect(missingArgsRes.status).toBe(400);
  });

  it('renders templates in domain logic', () => {
    expect(NotificationType.TELEGRAM).toBe('telegram');

    const template = 'Hello, {{name}}! Your code is {{code}}. Unknown: {{missing}}.';
    const rendered = renderTemplate(template, { name: 'Bob', code: 12345 });
    expect(rendered).toBe('Hello, Bob! Your code is 12345. Unknown: {{missing}}.');
  });

  it('validates TelegramProviderOptions in domain logic', () => {
    // Valid options without proxy
    const validNoProxy = validateTelegramOptions({
      token: 'bot123:TOKEN',
      chat_id: 998877,
    });
    expect(validNoProxy.token).toBe('bot123:TOKEN');
    expect(validNoProxy.chat_id).toBe(998877);
    expect(validNoProxy.proxy).toBeUndefined();

    // Valid options with proxy
    const validWithProxy = validateTelegramOptions({
      token: 'bot123:TOKEN',
      chat_id: '@my_channel',
      proxy: 'https://proxy.example.com:8443',
    });
    expect(validWithProxy.proxy).toBe('https://proxy.example.com:8443');

    // Missing token
    expect(() => validateTelegramOptions({ chat_id: 123 })).toThrow(
      "Telegram provider options must include a non-empty 'token'"
    );

    // Empty token
    expect(() => validateTelegramOptions({ token: '   ', chat_id: 123 })).toThrow(
      "Telegram provider options must include a non-empty 'token'"
    );

    // Missing chat_id
    expect(() => validateTelegramOptions({ token: 'bot:123' })).toThrow(
      "Telegram provider options must include a valid 'chat_id'"
    );

    // Invalid proxy URL
    expect(() =>
      validateTelegramOptions({ token: 'bot:123', chat_id: '123', proxy: 'not-a-valid-url' })
    ).toThrow("Telegram provider 'proxy' must be a valid URL");
  });

  it('sends telegram message using gramio Bot via NotifyTelegramRepository with proxy', async () => {
    let capturedToken = '';
    let capturedProxy: string | undefined;
    let capturedChatId: string | number | undefined;
    let capturedText = '';

    const telegramRepo = new NotifyTelegramRepository((token, proxy) => {
      capturedToken = token;
      capturedProxy = proxy;
      return {
        api: {
          sendMessage: async (params) => {
            capturedChatId = params.chat_id;
            capturedText = params.text;
            return { ok: true };
          },
        },
      };
    });

    await telegramRepo.sendMessage(
      {
        token: 'test-gramio-token',
        chat_id: '-100998877',
        proxy: 'http://127.0.0.1:9050',
      },
      'Test notification text from repository'
    );

    expect(capturedToken).toBe('test-gramio-token');
    expect(capturedProxy).toBe('http://127.0.0.1:9050');
    expect(capturedChatId).toBe('-100998877');
    expect(capturedText).toBe('Test notification text from repository');
  });

  it('handles not-found errors gracefully for providers and templates', async () => {
    const { app, adminToken, userRepo, authUsecase } = await createTestApp();

    // Provider not found
    const notFoundProv = await app.request('/provider/non-existing-id', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(notFoundProv.status).toBe(404);

    // Template not found
    const notFoundTemplate = await app.request('/template/non-existing-id', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    expect(notFoundTemplate.status).toBe(404);

    // Create user with access to 'non-existing-id' so template access passes but template lookup fails
    const userHashedPassword = await Bun.password.hash('testpass');
    await userRepo.create({
      name: 'Tester',
      email: 'tester@example.com',
      password: userHashedPassword,
      role: 'user',
      template_ids: ['non-existing-id'],
    });
    const { token: userToken } = await authUsecase.login('tester@example.com', 'testpass');

    // Notify non-existent template
    const notFoundNotifyRes = await app.request('/notify/non-existing-id', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ args: { some: 'val' } }),
    });
    expect(notFoundNotifyRes.status).toBe(404);
  });

  it('issues indefinite JWT token when onlyNotify is true, restricted only to notify endpoint', async () => {
    const { app, adminToken, authUsecase, adminPassword } = await createTestApp();

    // 1. Create provider and template as admin
    const provRes = await app.request('/provider', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Alerts Bot',
        type: 'telegram',
        options: { token: 'tok-123', chat_id: '123' },
      }),
    });
    const prov = (await provRes.json()) as { id: string };

    const tplRes = await app.request('/template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'alert_msg',
        content: 'System alert: {{msg}}',
        provider_id: prov.id,
      }),
    });
    const template = (await tplRes.json()) as { id: string };

    // 2. Create another template
    const tplRes2 = await app.request('/template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'other_msg',
        content: 'Other: {{msg}}',
        provider_id: prov.id,
      }),
    });
    const template2 = (await tplRes2.json()) as { id: string };

    // 3. Register user with access ONLY to template 1
    const regRes = await app.request('/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'Service Worker',
        email: 'worker@example.com',
        password: 'workerpassword123',
        role: 'user',
        template_ids: [template.id],
      }),
    });
    expect(regRes.status).toBe(201);

    // 4. Login with onlyNotify: true
    const loginRes = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'worker@example.com',
        password: 'workerpassword123',
        onlyNotify: true,
      }),
    });
    expect(loginRes.status).toBe(200);
    const loginData = (await loginRes.json()) as { token: string };
    const notifyToken = loginData.token;

    // Verify token has no exp claim (indefinite validity)
    const decoded = await authUsecase.verifyToken(notifyToken);
    expect(decoded.onlyNotify).toBe(true);
    expect(decoded.exp).toBeUndefined();

    // 5. onlyNotify token CAN access notify for permitted template
    const notifyOk = await app.request(`/notify/${template.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${notifyToken}`,
      },
      body: JSON.stringify({ args: { msg: 'Server CPU high' } }),
    });
    expect(notifyOk.status).toBe(200);

    // 6. onlyNotify token CANNOT access notify for non-permitted template (403)
    const notifyForbidden = await app.request(`/notify/${template2.id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${notifyToken}`,
      },
      body: JSON.stringify({ args: { msg: 'Test' } }),
    });
    expect(notifyForbidden.status).toBe(403);

    // 7. onlyNotify token CANNOT access template endpoints (403)
    const templateAccess = await app.request('/template', {
      headers: { Authorization: `Bearer ${notifyToken}` },
    });
    expect(templateAccess.status).toBe(403);

    // 8. onlyNotify token CANNOT access provider endpoints (403)
    const providerAccess = await app.request('/provider', {
      headers: { Authorization: `Bearer ${notifyToken}` },
    });
    expect(providerAccess.status).toBe(403);

    // 9. Even an admin with onlyNotify: true cannot access template/provider endpoints
    const adminNotifyLogin = await app.request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: adminPassword,
        onlyNotify: true,
      }),
    });
    const adminNotifyToken = ((await adminNotifyLogin.json()) as { token: string }).token;

    const adminTemplateRes = await app.request('/template', {
      headers: { Authorization: `Bearer ${adminNotifyToken}` },
    });
    expect(adminTemplateRes.status).toBe(403);
  });

  it('exports CONFIG object with valid configuration defaults and environment settings', () => {
    expect(CONFIG).toBeDefined();
    expect(typeof CONFIG.PORT).toBe('number');
    expect(typeof CONFIG.DB_PATH).toBe('string');
    expect(typeof CONFIG.JWT_SECRET).toBe('string');
    expect(typeof CONFIG.JWT_EXPIRES_IN).toBe('number');
    expect(typeof CONFIG.HOST).toBe('string');
    expect(typeof CONFIG.NODE_ENV).toBe('string');

    // Test camelCase getters
    expect(CONFIG.port).toBe(CONFIG.PORT);
    expect(CONFIG.dbPath).toBe(CONFIG.DB_PATH);
    expect(CONFIG.jwtSecret).toBe(CONFIG.JWT_SECRET);
    expect(CONFIG.jwtExpiresIn).toBe(CONFIG.JWT_EXPIRES_IN);
    expect(CONFIG.host).toBe(CONFIG.HOST);
    expect(CONFIG.nodeEnv).toBe(CONFIG.NODE_ENV);
  });
});
