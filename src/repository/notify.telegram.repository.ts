import { Bot } from 'gramio';
import type { TelegramNotificationRepository } from '../usecase/notify.telegram.repository';
import { type TelegramProviderOptions, validateTelegramOptions } from '../domain/provider';

export type BotFactory = (
  token: string,
  proxy?: string
) => {
  api: {
    sendMessage(params: { chat_id: string | number; text: string }): Promise<unknown>;
  };
};

export class NotifyTelegramRepository implements TelegramNotificationRepository {
  private readonly botFactory: BotFactory;

  constructor(botFactory?: BotFactory) {
    this.botFactory =
      botFactory ??
      ((token: string, proxy?: string) =>
        // @ts-expect-error - The `fetchOptions` type does not include `proxy`, but it is supported by the underlying library.
        new Bot({
          token,
          api: proxy
            ? {
                fetchOptions: {
                  proxy,
                },
              }
            : undefined,
        }));
  }

  async sendMessage(
    options: TelegramProviderOptions | Record<string, unknown>,
    text: string
  ): Promise<void> {
    const validated = validateTelegramOptions(options);

    const bot = this.botFactory(validated.token, validated.proxy);

    await bot.api.sendMessage({
      chat_id: validated.chat_id,
      text,
    });
  }
}
