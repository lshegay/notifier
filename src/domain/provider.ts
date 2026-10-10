import type { NotificationType } from './notification';
import { ValidationError } from './errors';

export type Provider = {
  id: string;
  name: string;
  type: NotificationType | string;
  options: Record<string, unknown>;
  origins: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type CreateProviderDTO = {
  name: string;
  type: NotificationType | string;
  options?: Record<string, unknown>;
  origins?: string[];
};

export type UpdateProviderDTO = {
  name?: string;
  type?: NotificationType | string;
  options?: Record<string, unknown>;
  origins?: string[];
};

export type TelegramProviderOptions = {
  token: string;
  chat_id: string | number;
  proxy?: string;
};

export function validateTelegramOptions(options: unknown): TelegramProviderOptions {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new ValidationError('Telegram provider options must be an object');
  }

  const opt = options as Record<string, unknown>;

  if (typeof opt.token !== 'string' || !opt.token.trim()) {
    throw new ValidationError("Telegram provider options must include a non-empty 'token'");
  }

  if (
    opt.chat_id === undefined ||
    opt.chat_id === null ||
    (typeof opt.chat_id !== 'string' && typeof opt.chat_id !== 'number') ||
    (typeof opt.chat_id === 'string' && !opt.chat_id.trim())
  ) {
    throw new ValidationError(
      "Telegram provider options must include a valid 'chat_id' (string or number)"
    );
  }

  let proxy: string | undefined;
  if (opt.proxy !== undefined && opt.proxy !== null) {
    if (typeof opt.proxy !== 'string' || !opt.proxy.trim()) {
      throw new ValidationError("Telegram provider 'proxy' must be a non-empty string");
    }
    try {
      new URL(opt.proxy.trim());
    } catch {
      throw new ValidationError("Telegram provider 'proxy' must be a valid URL");
    }
    proxy = opt.proxy.trim();
  }

  return {
    token: opt.token.trim(),
    chat_id: typeof opt.chat_id === 'string' ? opt.chat_id.trim() : opt.chat_id,
    ...(proxy ? { proxy } : {}),
  };
}
