CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL DEFAULT 'Neues Projekt',
  code        TEXT NOT NULL,
  parameters  JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE spartenplan_uploads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  feature_collection JSONB NOT NULL,
  meta               JSONB NOT NULL,
  uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE parcel_uploads (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id         UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  feature_collection JSONB NOT NULL,
  meta               JSONB NOT NULL,
  uploaded_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
