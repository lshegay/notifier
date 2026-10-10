import type { ProviderUsecase } from './provider.usecase';
import type { TemplateUsecase } from './template.usecase';
import type { AuthUsecase } from './auth.usecase';
import { NotificationType } from '../domain/notification';
import { ValidationError } from '../domain/errors';

export type QuickRegisterDTO = {
  name: string;
  content: string;
  template_type: string;
  options?: Record<string, unknown>;
  provider_options?: Record<string, unknown>;
};

export type QuickRegisterResult = {
  jwt_token: string;
  template_id: string;
  id: string;
};

export class QuickRegisterUsecase {
  constructor(
    private readonly providerUsecase: ProviderUsecase,
    private readonly templateUsecase: TemplateUsecase,
    private readonly authUsecase: AuthUsecase
  ) {}

  async execute(dto: QuickRegisterDTO): Promise<QuickRegisterResult> {
    if (!dto.name || typeof dto.name !== 'string' || !dto.name.trim()) {
      throw new ValidationError('Name is required and must not be empty');
    }
    if (dto.content === undefined || typeof dto.content !== 'string' || !dto.content.trim()) {
      throw new ValidationError('Content is required and must not be empty');
    }
    if (!dto.template_type || typeof dto.template_type !== 'string' || !dto.template_type.trim()) {
      throw new ValidationError('template_type is required');
    }

    const normalizedType = dto.template_type.trim().toLowerCase();
    if (normalizedType !== NotificationType.TELEGRAM) {
      throw new ValidationError(
        `Invalid template_type '${dto.template_type}'. Currently only '${NotificationType.TELEGRAM}' is supported.`
      );
    }

    const entityName = `${dto.name.trim()}-${normalizedType}`;

    const defaultTelegramOptions = {
      token: 'quick-register-token',
      chat_id: 'quick-register-chat-id',
    };

    const rawOptions = dto.options ?? dto.provider_options;
    const providerOptions =
      rawOptions && typeof rawOptions === 'object' && Object.keys(rawOptions).length > 0
        ? rawOptions
        : defaultTelegramOptions;

    // 1. Create provider for template_type
    const provider = await this.providerUsecase.createProvider({
      name: entityName,
      type: normalizedType,
      options: providerOptions,
    });

    // 2. Create template with message content
    const template = await this.templateUsecase.createTemplate({
      name: entityName,
      content: dto.content,
      provider_id: provider.id,
    });

    // 3. Create user with random name, email and password
    const randomSuffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    const randomName = `user_${randomSuffix}`;
    const randomEmail = `user_${crypto.randomUUID()}@notifier.local`;
    const randomPassword = crypto.randomUUID();

    await this.authUsecase.register(
      {
        name: randomName,
        email: randomEmail,
        password: randomPassword,
        role: 'user',
        template_ids: [template.id],
      },
      'admin'
    );

    // 4. Log in user with onlyNotify: true to generate indefinite token
    const { token } = await this.authUsecase.login(randomEmail, randomPassword, true);

    return {
      jwt_token: token,
      template_id: template.id,
      id: template.id,
    };
  }
}
