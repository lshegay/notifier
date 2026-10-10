import type { CreateProviderDTO, Provider, UpdateProviderDTO } from '../domain/provider';

export interface ProviderRepository {
  findById(id: string): Promise<Provider | null>;
  create(data: CreateProviderDTO): Promise<Provider>;
  update(id: string, data: UpdateProviderDTO): Promise<Provider | null>;
  delete(id: string): Promise<boolean>;
  findAll(): Promise<Provider[]>;
  findByType(type: string): Promise<Provider[]>;
}
