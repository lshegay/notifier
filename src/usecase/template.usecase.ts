import type { TemplateRepository } from './template.repository';
import type { ProviderRepository } from './provider.repository';
import type { Template, CreateTemplateDTO, UpdateTemplateDTO } from '../domain/template';
import { ProviderNotFoundError, TemplateNotFoundError, ValidationError } from '../domain/errors';

export class TemplateUsecase {
  constructor(
    private readonly templateRepo: TemplateRepository,
    private readonly providerRepo?: ProviderRepository
  ) {}

  async createTemplate(dto: CreateTemplateDTO): Promise<Template> {
    if (!dto.name || typeof dto.name !== 'string' || !dto.name.trim()) {
      throw new ValidationError('Template name is required and must be a non-empty string');
    }
    if (dto.content === undefined || typeof dto.content !== 'string') {
      throw new ValidationError('Template content is required and must be a string');
    }
    if (!dto.provider_id || typeof dto.provider_id !== 'string' || !dto.provider_id.trim()) {
      throw new ValidationError('Provider ID is required and must be a non-empty string');
    }

    if (this.providerRepo) {
      const provider = await this.providerRepo.findById(dto.provider_id.trim());
      if (!provider) {
        throw new ProviderNotFoundError(dto.provider_id.trim());
      }
    }

    return this.templateRepo.create({
      name: dto.name.trim(),
      content: dto.content,
      provider_id: dto.provider_id.trim(),
    });
  }

  async getTemplate(id: string): Promise<Template> {
    const template = await this.templateRepo.findById(id);
    if (!template) {
      throw new TemplateNotFoundError(id);
    }
    return template;
  }

  async listTemplates(providerId?: string): Promise<Template[]> {
    if (providerId && providerId.trim()) {
      return this.templateRepo.findByProviderId(providerId.trim());
    }
    return this.templateRepo.findAll();
  }

  async updateTemplate(id: string, dto: UpdateTemplateDTO): Promise<Template> {
    if (dto.name === undefined && dto.content === undefined && dto.provider_id === undefined) {
      throw new ValidationError(
        "At least one of 'name', 'content', or 'provider_id' must be provided"
      );
    }

    if (dto.name !== undefined && (typeof dto.name !== 'string' || !dto.name.trim())) {
      throw new ValidationError('Template name must be a non-empty string');
    }
    if (dto.content !== undefined && typeof dto.content !== 'string') {
      throw new ValidationError('Template content must be a string');
    }
    if (
      dto.provider_id !== undefined &&
      (typeof dto.provider_id !== 'string' || !dto.provider_id.trim())
    ) {
      throw new ValidationError('Provider ID must be a non-empty string');
    }

    if (dto.provider_id !== undefined && this.providerRepo) {
      const provider = await this.providerRepo.findById(dto.provider_id.trim());
      if (!provider) {
        throw new ProviderNotFoundError(dto.provider_id.trim());
      }
    }

    const updated = await this.templateRepo.update(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.content !== undefined ? { content: dto.content } : {}),
      ...(dto.provider_id !== undefined ? { provider_id: dto.provider_id.trim() } : {}),
    });

    if (!updated) {
      throw new TemplateNotFoundError(id);
    }
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const deleted = await this.templateRepo.delete(id);
    if (!deleted) {
      throw new TemplateNotFoundError(id);
    }
    return true;
  }
}
