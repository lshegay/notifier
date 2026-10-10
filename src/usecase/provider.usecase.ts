import type { ProviderRepository } from './provider.repository';
import {
  type Provider,
  type CreateProviderDTO,
  type UpdateProviderDTO,
  validateTelegramOptions,
} from '../domain/provider';
import { NotificationType } from '../domain/notification';
import { ProviderNotFoundError, ValidationError } from '../domain/errors';

export class ProviderUsecase {
  constructor(private readonly providerRepo: ProviderRepository) {}

  async createProvider(dto: CreateProviderDTO): Promise<Provider> {
    if (!dto.name || typeof dto.name !== 'string' || !dto.name.trim()) {
      throw new ValidationError('Provider name is required and must be a non-empty string');
    }
    if (!dto.type || typeof dto.type !== 'string' || !dto.type.trim()) {
      throw new ValidationError('Provider type is required and must be a non-empty string');
    }

    const normalizedType = dto.type.trim().toLowerCase();
    const validNotificationTypes = Object.values(NotificationType) as string[];
    if (!validNotificationTypes.includes(normalizedType)) {
      throw new ValidationError(
        `Invalid provider type '${dto.type}'. Supported types: ${validNotificationTypes.join(', ')}`
      );
    }

    if (
      dto.options !== undefined &&
      (typeof dto.options !== 'object' || Array.isArray(dto.options) || dto.options === null)
    ) {
      throw new ValidationError('Provider options must be an object');
    }

    if (normalizedType === NotificationType.TELEGRAM) {
      validateTelegramOptions(dto.options);
    }

    if (dto.origins !== undefined) {
      if (!Array.isArray(dto.origins) || !dto.origins.every((o) => typeof o === 'string')) {
        throw new ValidationError("Provider 'origins' must be an array of strings");
      }
    }

    return this.providerRepo.create({
      name: dto.name.trim(),
      type: normalizedType,
      options: dto.options ?? {},
      origins: dto.origins ?? [],
    });
  }

  async getProvider(id: string): Promise<Provider> {
    const provider = await this.providerRepo.findById(id);
    if (!provider) {
      throw new ProviderNotFoundError(id);
    }
    return provider;
  }

  async listProviders(type?: string): Promise<Provider[]> {
    if (type && type.trim()) {
      return this.providerRepo.findByType(type.trim().toLowerCase());
    }
    return this.providerRepo.findAll();
  }

  async updateProvider(id: string, dto: UpdateProviderDTO): Promise<Provider> {
    if (
      dto.name === undefined &&
      dto.type === undefined &&
      dto.options === undefined &&
      dto.origins === undefined
    ) {
      throw new ValidationError(
        "At least one of 'name', 'type', 'options', or 'origins' must be provided"
      );
    }

    if (dto.name !== undefined && (typeof dto.name !== 'string' || !dto.name.trim())) {
      throw new ValidationError('Provider name must be a non-empty string');
    }

    if (dto.origins !== undefined) {
      if (!Array.isArray(dto.origins) || !dto.origins.every((o) => typeof o === 'string')) {
        throw new ValidationError("Provider 'origins' must be an array of strings");
      }
    }

    let normalizedType: string | undefined;
    if (dto.type !== undefined) {
      if (typeof dto.type !== 'string' || !dto.type.trim()) {
        throw new ValidationError('Provider type must be a non-empty string');
      }
      normalizedType = dto.type.trim().toLowerCase();
      const validNotificationTypes = Object.values(NotificationType) as string[];
      if (!validNotificationTypes.includes(normalizedType)) {
        throw new ValidationError(
          `Invalid provider type '${dto.type}'. Supported types: ${validNotificationTypes.join(', ')}`
        );
      }
    }

    if (
      dto.options !== undefined &&
      (typeof dto.options !== 'object' || Array.isArray(dto.options) || dto.options === null)
    ) {
      throw new ValidationError('Provider options must be an object');
    }

    const current = await this.providerRepo.findById(id);
    if (!current) {
      throw new ProviderNotFoundError(id);
    }

    const effectiveType = normalizedType ?? current.type;
    const effectiveOptions = dto.options !== undefined ? dto.options : current.options;

    if (effectiveType === NotificationType.TELEGRAM) {
      validateTelegramOptions(effectiveOptions);
    }

    const updated = await this.providerRepo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(normalizedType !== undefined ? { type: normalizedType } : {}),
      ...(dto.options !== undefined ? { options: dto.options } : {}),
      ...(dto.origins !== undefined ? { origins: dto.origins } : {}),
    });

    if (!updated) {
      throw new ProviderNotFoundError(id);
    }
    return updated;
  }

  async deleteProvider(id: string): Promise<boolean> {
    const deleted = await this.providerRepo.delete(id);
    if (!deleted) {
      throw new ProviderNotFoundError(id);
    }
    return true;
  }
}
