import { ProviderNotFoundError, TemplateNotFoundError, ValidationError } from '../domain/errors';
import type { NotificationResult } from '../domain/notification';
import { NotificationType, renderTemplate } from '../domain/notification';
import { validateTelegramOptions, type Provider } from '../domain/provider';
import type { TelegramNotificationRepository } from './notify.telegram.repository';
import type { ProviderRepository } from './provider.repository';
import type { TemplateRepository } from './template.repository';

export class NotifyUsecase {
  constructor(
    private readonly templateRepo: TemplateRepository,
    private readonly providerRepo: ProviderRepository,
    private readonly telegramRepo?: TelegramNotificationRepository
  ) {}

  async execute(templateId: string, args: Record<string, unknown>): Promise<NotificationResult> {
    if (!templateId || typeof templateId !== 'string') {
      throw new ValidationError('Template ID is required');
    }

    if (!args || typeof args !== 'object' || Array.isArray(args)) {
      throw new ValidationError("Field 'args' must be an object");
    }

    const template = await this.templateRepo.findById(templateId);
    if (!template) {
      throw new TemplateNotFoundError(templateId);
    }

    const provider = await this.providerRepo.findById(template.provider_id);
    if (!provider) {
      throw new ProviderNotFoundError(template.provider_id);
    }

    const renderedContent = renderTemplate(template.content, args);

    // Execute dispatcher corresponding to provider.type
    await this.dispatch(provider, renderedContent);

    const result: NotificationResult = {
      templateId,
      providerId: template.provider_id,
      renderedContent,
      args,
      sentAt: new Date(),
    };

    return result;
  }

  private async dispatch(provider: Provider, content: string): Promise<void> {
    switch (provider.type) {
      case NotificationType.TELEGRAM:
        await this.sendTelegram(provider, content);
        break;
      default:
        throw new ValidationError(`Unsupported provider type: ${provider.type}`);
    }
  }

  private async sendTelegram(provider: Provider, content: string): Promise<void> {
    if (!this.telegramRepo) {
      return;
    }
    const validatedOptions = validateTelegramOptions(provider.options);
    await this.telegramRepo.sendMessage(validatedOptions, content);
  }
}
