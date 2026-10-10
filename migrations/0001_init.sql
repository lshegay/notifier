CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  options TEXT NOT NULL DEFAULT '{}',
  origins TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  content TEXT NOT NULL,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  template_ids TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_providers_type ON providers(type);

CREATE INDEX IF NOT EXISTS idx_templates_provider_id ON templates(provider_id);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
