import type { Database } from 'bun:sqlite';
import { randomUUID } from 'node:crypto';
import type { ProviderRepository } from '../usecase/provider.repository';
import type { Provider, CreateProviderDTO, UpdateProviderDTO } from '../domain/provider';

type ProviderRow = {
  id: string;
  name: string;
  type: string;
  options: string;
  created_at: string;
  updated_at: string;
};

export class SqliteProviderRepository implements ProviderRepository {
  constructor(private readonly db: Database) {}

  private mapRowToEntity(row: ProviderRow): Provider {
    let options: Record<string, unknown> = {};
    try {
      options = JSON.parse(row.options);
    } catch {
      options = {};
    }

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      options,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findById(id: string): Promise<Provider | null> {
    const row = this.db
      .prepare('SELECT * FROM providers WHERE id = $id')
      .get({ $id: id }) as ProviderRow | null;

    if (!row) {
      return null;
    }
    return this.mapRowToEntity(row);
  }

  async create(data: CreateProviderDTO): Promise<Provider> {
    const id = randomUUID();
    const now = new Date();
    const createdAt = now.toISOString();
    const updatedAt = now.toISOString();
    const options = data.options ?? {};
    const optionsJson = JSON.stringify(options);

    this.db
      .prepare(
        `INSERT INTO providers (id, name, type, options, created_at, updated_at)
         VALUES ($id, $name, $type, $options, $createdAt, $updatedAt)`
      )
      .run({
        $id: id,
        $name: data.name,
        $type: data.type,
        $options: optionsJson,
        $createdAt: createdAt,
        $updatedAt: updatedAt,
      });

    return {
      id,
      name: data.name,
      type: data.type,
      options,
      createdAt: now,
      updatedAt: now,
    };
  }

  async update(id: string, data: UpdateProviderDTO): Promise<Provider | null> {
    const current = await this.findById(id);
    if (!current) {
      return null;
    }

    const now = new Date();
    const name = data.name !== undefined ? data.name : current.name;
    const type = data.type !== undefined ? data.type : current.type;
    const options = data.options !== undefined ? data.options : current.options;
    const updatedAt = now.toISOString();

    this.db
      .prepare(
        `UPDATE providers
         SET name = $name, type = $type, options = $options, updated_at = $updatedAt
         WHERE id = $id`
      )
      .run({
        $id: id,
        $name: name,
        $type: type,
        $options: JSON.stringify(options),
        $updatedAt: updatedAt,
      });

    return {
      id,
      name,
      type,
      options,
      createdAt: current.createdAt,
      updatedAt: now,
    };
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM providers WHERE id = $id').run({ $id: id });
    return result.changes > 0;
  }

  async findAll(): Promise<Provider[]> {
    const rows = this.db
      .prepare('SELECT * FROM providers ORDER BY created_at ASC')
      .all() as ProviderRow[];
    return rows.map((row) => this.mapRowToEntity(row));
  }

  async findByType(type: string): Promise<Provider[]> {
    const rows = this.db
      .prepare('SELECT * FROM providers WHERE type = $type ORDER BY created_at ASC')
      .all({ $type: type }) as ProviderRow[];
    return rows.map((row) => this.mapRowToEntity(row));
  }
}
