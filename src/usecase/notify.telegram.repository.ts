import type { TelegramProviderOptions } from '../domain/notification';

export interface TelegramNotificationRepository {
  sendMessage(options: TelegramProviderOptions, text: string): Promise<void>;
}
