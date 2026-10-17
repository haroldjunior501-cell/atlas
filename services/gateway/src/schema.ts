export const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS accounts (
  user_id text PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  organization_name text NOT NULL
);

CREATE TABLE IF NOT EXISTS organizations (
  id text PRIMARY KEY,
  owner_id text NOT NULL REFERENCES users (id),
  name text NOT NULL,
  intention text NOT NULL,
  objective text
);

CREATE TABLE IF NOT EXISTS departments (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name text NOT NULL
);

CREATE TABLE IF NOT EXISTS agents (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  department_id text NOT NULL REFERENCES departments (id),
  reports_to_id text REFERENCES agents (id) DEFERRABLE INITIALLY DEFERRED,
  first_name text NOT NULL,
  last_name text NOT NULL,
  role text NOT NULL,
  mission text NOT NULL,
  presence text NOT NULL,
  personality jsonb NOT NULL,
  skills jsonb NOT NULL,
  objectives jsonb NOT NULL,
  tool_ids jsonb NOT NULL,
  permissions jsonb NOT NULL,
  delegation text NOT NULL,
  avatar jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  agent_id text NOT NULL,
  title text NOT NULL,
  status text NOT NULL,
  mission_id text
);

CREATE TABLE IF NOT EXISTS decisions (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  requested_by_agent_id text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  amount double precision,
  risk text NOT NULL,
  status text NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  mime_type text NOT NULL,
  accessible_to jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS meetings (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  title text NOT NULL,
  starts_at text NOT NULL,
  created_by_agent_id text,
  agenda jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  participant_ids jsonb NOT NULL,
  kind text NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id text PRIMARY KEY,
  conversation_id text NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
  author_id text NOT NULL,
  body text NOT NULL,
  created_at text NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_entries (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  actor_id text NOT NULL,
  action text NOT NULL,
  permission text,
  reason text NOT NULL,
  at text NOT NULL
);

CREATE TABLE IF NOT EXISTS integrations (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_relations (
  id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  from_agent_id text NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  to_agent_id text NOT NULL REFERENCES agents (id) ON DELETE CASCADE,
  kind text NOT NULL
);
`
