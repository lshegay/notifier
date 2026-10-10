import type { Database } from 'bun:sqlite';
import { randomUUID } from 'node:crypto';
import type { TemplateRepository } from '../usecase/template.repository';
import type { Template, CreateTemplateDTO, UpdateTemplateDTO } from '../domain/template';

type TemplateRow = {
  id: string;
  name: string;
  content: string;
  provider_id: string;
  created_at: string;
  updated_at: string;
};

export class SqliteTemplateRepository implements TemplateRepository {
  constructor(private readonly db: Database) {}

  private mapRowToEntity(row: TemplateRow): Template {
    return {
      id: row.id,
      name: row.name,
      content: row.content,
      provider_id: row.provider_id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findById(id: string): Promise<Template | null> {
    const row = this.db
      .prepare('SELECT * FROM templates WHERE id = $id')
      .get({ $id: id }) as TemplateRow | null;

    if (!row) {
      return null;
    }
    return this.mapRowToEntity(row);
  }

  async create(data: CreateTemplateDTO): Promise<Template> {
    const id = randomUUID();
    const now = new Date();
    const createdAt = now.toISOString();
    const updatedAt = now.toISOString();

    this.db
      .prepare(
        `INSERT INTO templates (id, name, content, provider_id, created_at, updated_at)
         VALUES ($id, $name, $content, $provider_id, $createdAt, $updatedAt)`
      )
      .run({
        $id: id,
        $name: data.name,
        $content: data.content,
        $provider_id: data.provider_id,
        $createdAt: createdAt,
        $updatedAt: updatedAt,
      });

    return {
      id,
      name: data.name,
      content: data.content,
      provider_id: data.provider_id,
      createdAt: now,
      updatedAt: now,
    };
  }

  async update(id: string, data: UpdateTemplateDTO): Promise<Template | null> {
    const current = await this.findById(id);
    if (!current) {
      return null;
    }

    const now = new Date();
    const name = data.name !== undefined ? data.name : current.name;
    const content = data.content !== undefined ? data.content : current.content;
    const providerId = data.provider_id !== undefined ? data.provider_id : current.provider_id;
    const updatedAt = now.toISOString();

    this.db
      .prepare(
        `UPDATE templates
         SET name = $name, content = $content, provider_id = $provider_id, updated_at = $updatedAt
         WHERE id = $id`
      )
      .run({
        $id: id,
        $name: name,
        $content: content,
        $provider_id: providerId,
        $updatedAt: updatedAt,
      });

    return {
      id,
      name,
      content,
      provider_id: providerId,
      createdAt: current.createdAt,
      updatedAt: now,
    };
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM templates WHERE id = $id').run({ $id: id });
    return result.changes > 0;
  }

  async findAll(): Promise<Template[]> {
    const rows = this.db
      .prepare('SELECT * FROM templates ORDER BY created_at ASC')
      .all() as TemplateRow[];
    return rows.map((row) => this.mapRowToEntity(row));
  }

  async findByProviderId(providerId: string): Promise<Template[]> {
    const rows = this.db
      .prepare('SELECT * FROM templates WHERE provider_id = $provider_id ORDER BY created_at ASC')
      .all({ $provider_id: providerId }) as TemplateRow[];
    return rows.map((row) => this.mapRowToEntity(row));
  }
}
