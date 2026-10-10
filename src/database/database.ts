import { Database } from 'bun:sqlite';
import { getMigrations, migrate } from 'bun-sqlite-migrations';
import fs from 'node:fs';
import path from 'node:path';

export type DatabaseOptions = {
  dbPath: string;
  migrationsPath?: string;
};

export function createDatabase(options: DatabaseOptions): Database {
  const { dbPath } = options;
  const migrationsPath =
    options.migrationsPath ?? path.resolve(import.meta.dir, '../../migrations');

  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (dir && dir !== '.' && !fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath);

  // Enable foreign keys constraint enforcement
  db.run('PRAGMA foreign_keys = ON;');

  // Enable WAL mode for file-backed databases for concurrency and performance
  if (dbPath !== ':memory:') {
    db.run('PRAGMA journal_mode = WAL;');
  }

  // Execute migrations using patlux/bun-sqlite-migrations
  const migrations = getMigrations(migrationsPath);
  migrate(db, migrations);

  return db;
}
