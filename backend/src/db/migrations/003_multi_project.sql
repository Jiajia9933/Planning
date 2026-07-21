ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_user_id_key;

CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
