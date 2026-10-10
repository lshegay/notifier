import type { Database } from 'bun:sqlite';
import { randomUUID } from 'node:crypto';
import type { UserRepository } from '../usecase/user.repository';
import type { User, CreateUserDTO, UpdateUserDTO } from '../domain/user';

type UserRow = {
  id: string;
  name: string;
  email: string;
  password: string;
  role: string;
  template_ids: string;
  created_at: string;
  updated_at: string;
};

export class SqliteUserRepository implements UserRepository {
  constructor(private readonly db: Database) {}

  private mapRowToEntity(row: UserRow): User {
    let templateIds: string[] = [];
    try {
      templateIds = JSON.parse(row.template_ids);
    } catch {
      templateIds = [];
    }

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      password: row.password,
      role: row.role,
      template_ids: templateIds,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }

  async findById(id: string): Promise<User | null> {
    const row = this.db
      .prepare('SELECT * FROM users WHERE id = $id')
      .get({ $id: id }) as UserRow | null;

    if (!row) {
      return null;
    }
    return this.mapRowToEntity(row);
  }

  async findByEmail(email: string): Promise<User | null> {
    const row = this.db
      .prepare('SELECT * FROM users WHERE LOWER(email) = LOWER($email)')
      .get({ $email: email.trim().toLowerCase() }) as UserRow | null;

    if (!row) {
      return null;
    }
    return this.mapRowToEntity(row);
  }

  async create(data: CreateUserDTO): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    const createdAt = now.toISOString();
    const updatedAt = now.toISOString();
    const templateIds = data.template_ids ?? [];
    const templateIdsJson = JSON.stringify(templateIds);
    const role = data.role ?? 'user';
    const email = data.email.trim().toLowerCase();

    this.db
      .prepare(
        `INSERT INTO users (id, name, email, password, role, template_ids, created_at, updated_at)
         VALUES ($id, $name, $email, $password, $role, $templateIds, $createdAt, $updatedAt)`
      )
      .run({
        $id: id,
        $name: data.name.trim(),
        $email: email,
        $password: data.password,
        $role: role,
        $templateIds: templateIdsJson,
        $createdAt: createdAt,
        $updatedAt: updatedAt,
      });

    return {
      id,
      name: data.name.trim(),
      email,
      password: data.password,
      role,
      template_ids: templateIds,
      createdAt: now,
      updatedAt: now,
    };
  }

  async update(id: string, data: UpdateUserDTO): Promise<User | null> {
    const current = await this.findById(id);
    if (!current) {
      return null;
    }

    const now = new Date();
    const name = data.name !== undefined ? data.name.trim() : current.name;
    const email = data.email !== undefined ? data.email.trim().toLowerCase() : current.email;
    const password = data.password !== undefined ? data.password : current.password;
    const role = data.role !== undefined ? data.role : current.role;
    const templateIds = data.template_ids !== undefined ? data.template_ids : current.template_ids;
    const updatedAt = now.toISOString();

    this.db
      .prepare(
        `UPDATE users
         SET name = $name, email = $email, password = $password, role = $role, template_ids = $templateIds, updated_at = $updatedAt
         WHERE id = $id`
      )
      .run({
        $id: id,
        $name: name,
        $email: email,
        $password: password,
        $role: role,
        $templateIds: JSON.stringify(templateIds),
        $updatedAt: updatedAt,
      });

    return {
      id,
      name,
      email,
      password,
      role,
      template_ids: templateIds,
      createdAt: current.createdAt,
      updatedAt: now,
    };
  }

  async delete(id: string): Promise<boolean> {
    const result = this.db.prepare('DELETE FROM users WHERE id = $id').run({ $id: id });
    return result.changes > 0;
  }

  async findAll(): Promise<User[]> {
    const rows = this.db.prepare('SELECT * FROM users ORDER BY created_at ASC').all() as UserRow[];
    return rows.map((row) => this.mapRowToEntity(row));
  }

  async count(): Promise<number> {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    return row.count;
  }
}
