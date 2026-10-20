-- 001_initial_builder_schema.sql
-- Run only against a dedicated 4N DEV AI Builder database, never the Core database.

CREATE TABLE IF NOT EXISTS builder_users (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT builder_users_email_lowercase CHECK (email = LOWER(email))
);
CREATE UNIQUE INDEX IF NOT EXISTS builder_users_email_unique ON builder_users (email);

CREATE TABLE IF NOT EXISTS builder_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES builder_users(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS builder_sessions_user_idx ON builder_sessions(user_id);
CREATE INDEX IF NOT EXISTS builder_sessions_expiry_idx ON builder_sessions(expires_at);

CREATE TABLE IF NOT EXISTS builder_core_credentials (
  user_id UUID PRIMARY KEY REFERENCES builder_users(id) ON DELETE CASCADE,
  encrypted_key TEXT NOT NULL,
  encryption_iv TEXT NOT NULL,
  encryption_tag TEXT NOT NULL,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS builder_projects (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES builder_users(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL CHECK (length(trim(name)) > 0),
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS builder_projects_owner_updated_idx ON builder_projects(user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS builder_project_files (
  project_id UUID NOT NULL REFERENCES builder_projects(id) ON DELETE CASCADE,
  path VARCHAR(240) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, path),
  CONSTRAINT builder_project_file_relative_path CHECK (
    path <> '' AND left(path, 1) <> '/' AND position(chr(92) in path) = 0
  )
);
CREATE INDEX IF NOT EXISTS builder_project_files_project_idx ON builder_project_files(project_id);
