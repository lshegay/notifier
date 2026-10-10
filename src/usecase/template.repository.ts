import type { CreateTemplateDTO, Template, UpdateTemplateDTO } from '../domain/template';

export interface TemplateRepository {
  findById(id: string): Promise<Template | null>;
  create(data: CreateTemplateDTO): Promise<Template>;
  update(id: string, data: UpdateTemplateDTO): Promise<Template | null>;
  delete(id: string): Promise<boolean>;
  findAll(): Promise<Template[]>;
  findByProviderId(providerId: string): Promise<Template[]>;
}
