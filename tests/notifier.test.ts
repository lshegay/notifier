import { describe, expect, it } from 'bun:test';
import { createDatabase } from '../src/database/database';
import { createHonoApp } from '../src/delivery/http/app';
import { NotifyHandler } from '../src/delivery/http/handlers/notify.handler';
import { ProviderHandler } from '../src/delivery/http/handlers/provider.handler';
import { TemplateHandler } from '../src/delivery/http/handlers/template.handler';
import { NotificationType, renderTemplate } from '../src/domain/notification';
import { type TelegramProviderOptions, validateTelegramOptions } from '../src/domain/provider';
import { NotifyTelegramRepository } from '../src/repository/notify.telegram.repository';
import { SqliteProviderRepository } from '../src/repository/sqlite-provider.repository';
import { SqliteTemplateRepository } from '../src/repository/sqlite-template.repository';
import type { TelegramNotificationRepository } from '../src/usecase/notify.telegram.repository';
import { NotifyUsecase } from '../src/usecase/notify.usecase';
import { ProviderUsecase } from '../src/usecase/provider.usecase';
import { TemplateUsecase } from '../src/usecase/template.usecase';

function createTestApp(customTelegramRepo?: TelegramNotificationRepository) {
  const db = createDatabase({ dbPath: ':memory:' });
  const providerRepo = new SqliteProviderRepository(db);
  const templateRepo = new SqliteTemplateRepository(db);
  const sentTelegramMessages: Array<{ options: TelegramProviderOptions; text: string }> = [];

  const telegramRepo: TelegramNotificationRepository = customTelegramRepo ?? {
    sendMessage: async (options, text) => {
      sentTelegramMessages.push({ options, text });
    },
  };

  const providerUsecase = new ProviderUsecase(providerRepo);
  const templateUsecase = new TemplateUsecase(templateRepo, providerRepo);
  const notifyUsecase = new NotifyUsecase(templateRepo, providerRepo, telegramRepo);

  const providerHandler = new ProviderHandler(providerUsecase);
  const templateHandler = new TemplateHandler(templateUsecase);
  const notifyHandler = new NotifyHandler(notifyUsecase);

  const app = createHonoApp({
    providerHandler,
    templateHandler,
    notifyHandler,
  });

  return {
    app,
    db,
    providerRepo,
    templateRepo,
    telegramRepo,
    sentTelegramMessages,
  };
}

describe('Notifier Application with Providers, Templates, and Telegram Dispatcher', () => {
  it('creates, reads, updates, and deletes providers via HTTP', async () => {
    const { app } = createTestApp();

    // 1. Create provider (POST /provider)
    const createRes = await app.request('/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const getRes = await app.request(`/provider/${providerId}`);
    expect(getRes.status).toBe(200);
    const fetched = (await getRes.json()) as { id: string; name: string; type: string };
    expect(fetched.id).toBe(providerId);
    expect(fetched.name).toBe('Telegram Alerts Bot');
    expect(fetched.type).toBe('telegram');

    // 3. Update provider (PUT /provider/:id)
    const updateRes = await app.request(`/provider/${providerId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
    });
    expect(deleteRes.status).toBe(200);

    // 5. Verify deleted provider returns 404
    const getDeletedRes = await app.request(`/provider/${providerId}`);
    expect(getDeletedRes.status).toBe(404);
  });

  it('supports multiple providers per type and filtering by type', async () => {
    const { app } = createTestApp();

    // Create 3 telegram providers
    await app.request('/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Telegram Support Bot',
        type: 'telegram',
        options: { token: 'token-1', chat_id: 'support_chat' },
      }),
    });

    await app.request('/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Telegram Billing Bot',
        type: 'telegram',
        options: { token: 'token-2', chat_id: 'billing_chat' },
      }),
    });

    await app.request('/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Telegram Alerts Bot',
        type: 'telegram',
        options: { token: 'token-3', chat_id: 'alerts_chat' },
      }),
    });

    // List all providers
    const allRes = await app.request('/provider');
    expect(allRes.status).toBe(200);
    const allProviders = (await allRes.json()) as Array<{ id: string; type: string }>;
    expect(allProviders.length).toBe(3);

    // List only telegram providers
    const tgRes = await app.request('/provider?type=telegram');
    expect(tgRes.status).toBe(200);
    const tgProviders = (await tgRes.json()) as Array<{ id: string; type: string }>;
    expect(tgProviders.length).toBe(3);
    expect(tgProviders.every((p) => p.type === 'telegram')).toBe(true);

    // Filter by type with no matching providers
    const emptyRes = await app.request('/provider?type=other');
    expect(emptyRes.status).toBe(200);
    const emptyProviders = (await emptyRes.json()) as Array<{ id: string; type: string }>;
    expect(emptyProviders.length).toBe(0);
  });

  it('creates, reads, updates, and deletes templates with provider_id via HTTP', async () => {
    const { app } = createTestApp();

    // 1. Create a provider first
    const providerRes = await app.request('/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
    const getRes = await app.request(`/template/${templateId}`);
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
      headers: { 'Content-Type': 'application/json' },
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
    });
    expect(deleteRes.status).toBe(200);

    // 6. Verify deleted template returns 404
    const getDeletedRes = await app.request(`/template/${templateId}`);
    expect(getDeletedRes.status).toBe(404);
  });

  it('notifies and dispatches to telegram repository via POST /notify/:id', async () => {
    const { app, sentTelegramMessages } = createTestApp();

    // Create provider
    const provRes = await app.request('/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Order Telegram Bot',
        type: 'telegram',
        options: { token: 'bot-token-123', chat_id: '12345' },
      }),
    });
    const prov = (await provRes.json()) as { id: string };

    // Create template referencing provider
    const createRes = await app.request('/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'order_status',
        content: 'Order #{{order_id}} for {{customer_name}} is now {{status}}.',
        provider_id: prov.id,
      }),
    });
    const template = (await createRes.json()) as { id: string };

    // Call POST /notify/:id
    const notifyRes = await app.request(`/notify/${template.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    expect(notifyBody.data.providerId).toBe(prov.id);
    expect(notifyBody.data.templateId).toBe(template.id);

    // Verify telegram repository received the dispatch call
    expect(sentTelegramMessages).toHaveLength(1);
    expect(sentTelegramMessages[0]?.text).toBe('Order #9981 for Alice is now SHIPPED.');
    expect(sentTelegramMessages[0]?.options.token).toBe('bot-token-123');
    expect(sentTelegramMessages[0]?.options.chat_id).toBe('12345');
  });

  it('validates request inputs with Zod and returns 400 Bad Request', async () => {
    const { app } = createTestApp();

    // 1. Missing name in POST /provider
    const missingProvName = await app.request('/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'telegram', options: { token: 't', chat_id: '1' } }),
    });
    expect(missingProvName.status).toBe(400);

    // 2. Missing type in POST /provider
    const missingProvType = await app.request('/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'tg_bot' }),
    });
    expect(missingProvType.status).toBe(400);

    // 3. Invalid type in POST /provider (not in NotificationType enum)
    const invalidTypeRes = await app.request('/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'email_provider', type: 'email' }),
    });
    expect(invalidTypeRes.status).toBe(400);
    const invalidTypeBody = (await invalidTypeRes.json()) as { error?: string };
    expect(invalidTypeBody.error).toContain('Invalid provider type');

    // 4. Missing token in Telegram options
    const missingTokenRes = await app.request('/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'tg_bot', type: 'telegram', options: { chat_id: '123' } }),
    });
    expect(missingTokenRes.status).toBe(400);

    // 5. Missing chat_id in Telegram options
    const missingChatIdRes = await app.request('/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'tg_bot', type: 'telegram', options: { token: 'my_tok' } }),
    });
    expect(missingChatIdRes.status).toBe(400);

    // 6. Invalid proxy URL in Telegram options
    const invalidProxyRes = await app.request('/provider', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(emptyProvPut.status).toBe(400);

    // 8. Invalid type in PUT /provider/:id (not in NotificationType enum)
    const invalidPutTypeRes = await app.request('/provider/123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'whatsapp' }),
    });
    expect(invalidPutTypeRes.status).toBe(400);

    // 9. Missing provider_id in POST /template
    const missingProviderIdRes = await app.request('/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'welcome', content: 'hello' }),
    });
    expect(missingProviderIdRes.status).toBe(400);

    // 10. Non-existent provider_id in POST /template returns 404
    const notFoundProviderRes = await app.request('/template', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'some text', provider_id: 'p1' }),
    });
    expect(missingNameRes.status).toBe(400);

    // 12. PUT /template/:id with empty body
    const emptyPutRes = await app.request('/template/123', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(emptyPutRes.status).toBe(400);

    // 13. POST /notify/:id with missing args
    const missingArgsRes = await app.request('/notify/123', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(missingArgsRes.status).toBe(400);
  });

  it('renders templates in domain logic', () => {
    expect(NotificationType.TELEGRAM).toBe('telegram' as NotificationType);

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
    const { app } = createTestApp();

    // Provider not found
    const notFoundProv = await app.request('/provider/non-existing-id');
    expect(notFoundProv.status).toBe(404);

    // Template not found
    const notFoundTemplate = await app.request('/template/non-existing-id');
    expect(notFoundTemplate.status).toBe(404);

    // Notify non-existent template
    const notFoundNotifyRes = await app.request('/notify/non-existing-id', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ args: { some: 'val' } }),
    });
    expect(notFoundNotifyRes.status).toBe(404);
  });
});
