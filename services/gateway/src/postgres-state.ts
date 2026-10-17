import { Pool, type PoolClient } from 'pg'
import {
  createDatabase,
  type AtlasDatabase,
} from '@atlas/orchestrator'
import type {
  Agent,
  AgentRelation,
  AuditEntry,
  CompanyDocument,
  Conversation,
  Decision,
  Department,
  Integration,
  Meeting,
  Message,
  Organization,
  Task,
  User,
} from '@atlas/domain'
import { schemaSql } from './schema'

export interface AccountRecord {
  passwordHash: string
  organizationName: string
}

export interface Sql {
  query<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<{ rows: T[] }>
  exec(text: string): Promise<void>
}

export interface SqlSession extends Sql {
  tx<T>(run: (sql: Sql) => Promise<T>): Promise<T>
}

export function pgSession(connectionString: string): SqlSession {
  const pool = new Pool({
    connectionString,
    ssl: connectionString.includes('localhost') ? undefined : { rejectUnauthorized: false },
  })
  return {
    query: async <T = Record<string, unknown>>(text: string, values?: unknown[]) => {
      const result = await pool.query(text, values)
      return { rows: result.rows as T[] }
    },
    exec: async (text) => {
      await pool.query(text)
    },
    tx: (run) => withClient(pool, run),
  }
}

async function withClient<T>(pool: Pool, run: (sql: Sql) => Promise<T>): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const result = await run(clientSql(client))
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

function clientSql(client: PoolClient): Sql {
  return {
    query: async <T = Record<string, unknown>>(text: string, values?: unknown[]) => {
      const result = await client.query(text, values)
      return { rows: result.rows as T[] }
    },
    exec: async (text) => {
      await client.query(text)
    },
  }
}

function asJson<T>(value: unknown): T {
  if (typeof value === 'string') return JSON.parse(value) as T
  return value as T
}

function amount(value: unknown): number | null {
  if (value === null || value === undefined) return null
  return Number(value)
}

export class PostgresState {
  readonly runtime = 'postgres' as const
  private readonly accounts = new Map<string, AccountRecord>()
  private ready: Promise<void> | null = null

  constructor(private readonly sql: SqlSession) {}

  rememberAccount(userId: string, passwordHash: string, organizationName: string): void {
    this.accounts.set(userId, { passwordHash, organizationName })
  }

  accountFor(email: string, users: Iterable<User>): AccountRecord | undefined {
    const user = [...users].find((item) => item.email.toLowerCase() === email.toLowerCase())
    if (!user) return undefined
    return this.accounts.get(user.id)
  }

  private ensureSchema(): Promise<void> {
    this.ready ??= this.applySchema()
    return this.ready
  }

  private async applySchema(): Promise<void> {
    const statements = schemaSql
      .split(';')
      .map((statement) => statement.trim())
      .filter(Boolean)
    for (const statement of statements) await this.sql.exec(statement)
  }

  async load(): Promise<AtlasDatabase> {
    await this.ensureSchema()
    const db = createDatabase()
    const users = await this.sql.query<User>('SELECT id, name, email FROM users')
    for (const user of users.rows) db.users.set(user.id, user)

    const accounts = await this.sql.query<{ user_id: string; password_hash: string; organization_name: string }>(
      'SELECT user_id, password_hash, organization_name FROM accounts',
    )
    this.accounts.clear()
    for (const account of accounts.rows) {
      this.accounts.set(account.user_id, {
        passwordHash: account.password_hash,
        organizationName: account.organization_name,
      })
    }

    const organizations = await this.sql.query<{
      id: string
      owner_id: string
      name: string
      intention: string
      objective: string | null
    }>('SELECT id, owner_id, name, intention, objective FROM organizations')
    for (const row of organizations.rows) {
      const organization: Organization = {
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        intention: row.intention,
        objective: row.objective,
      }
      db.organizations.set(organization.id, organization)
    }

    const departments = await this.sql.query<{ id: string; organization_id: string; name: string }>(
      'SELECT id, organization_id, name FROM departments',
    )
    for (const row of departments.rows) {
      const department: Department = { id: row.id, organizationId: row.organization_id, name: row.name }
      db.departments.set(department.id, department)
    }

    const agents = await this.sql.query<Record<string, unknown>>('SELECT * FROM agents')
    for (const row of agents.rows) {
      const agent: Agent = {
        id: String(row.id),
        organizationId: String(row.organization_id),
        departmentId: String(row.department_id),
        reportsToId: row.reports_to_id ? String(row.reports_to_id) : null,
        firstName: String(row.first_name),
        lastName: String(row.last_name),
        role: String(row.role),
        mission: String(row.mission),
        presence: row.presence as Agent['presence'],
        personality: asJson(row.personality),
        skills: asJson(row.skills),
        objectives: asJson(row.objectives),
        toolIds: asJson(row.tool_ids),
        permissions: asJson(row.permissions),
        delegation: row.delegation as Agent['delegation'],
        avatar: asJson(row.avatar),
      }
      db.agents.set(agent.id, agent)
    }

    const relations = await this.sql.query<Record<string, unknown>>('SELECT * FROM agent_relations')
    db.relations.push(
      ...relations.rows.map(
        (row): AgentRelation => ({
          id: String(row.id),
          organizationId: String(row.organization_id),
          fromAgentId: String(row.from_agent_id),
          toAgentId: String(row.to_agent_id),
          kind: row.kind as AgentRelation['kind'],
        }),
      ),
    )

    const tasks = await this.sql.query<Record<string, unknown>>('SELECT * FROM tasks')
    db.tasks.push(
      ...tasks.rows.map(
        (row): Task => ({
          id: String(row.id),
          organizationId: String(row.organization_id),
          agentId: String(row.agent_id),
          title: String(row.title),
          status: row.status as Task['status'],
          missionId: row.mission_id ? String(row.mission_id) : null,
        }),
      ),
    )

    const decisions = await this.sql.query<Record<string, unknown>>('SELECT * FROM decisions')
    db.decisions.push(
      ...decisions.rows.map(
        (row): Decision => ({
          id: String(row.id),
          organizationId: String(row.organization_id),
          requestedByAgentId: String(row.requested_by_agent_id),
          title: String(row.title),
          summary: String(row.summary),
          amount: amount(row.amount),
          risk: row.risk as Decision['risk'],
          status: row.status as Decision['status'],
        }),
      ),
    )

    const documents = await this.sql.query<Record<string, unknown>>('SELECT * FROM documents')
    db.documents.push(
      ...documents.rows.map(
        (row): CompanyDocument => ({
          id: String(row.id),
          organizationId: String(row.organization_id),
          name: String(row.name),
          mimeType: String(row.mime_type),
          accessibleTo: asJson(row.accessible_to),
        }),
      ),
    )

    const meetings = await this.sql.query<Record<string, unknown>>('SELECT * FROM meetings')
    db.meetings.push(
      ...meetings.rows.map(
        (row): Meeting => ({
          id: String(row.id),
          organizationId: String(row.organization_id),
          title: String(row.title),
          startsAt: String(row.starts_at),
          createdByAgentId: row.created_by_agent_id ? String(row.created_by_agent_id) : null,
          agenda: asJson(row.agenda),
        }),
      ),
    )

    const conversations = await this.sql.query<Record<string, unknown>>('SELECT * FROM conversations')
    db.conversations.push(
      ...conversations.rows.map(
        (row): Conversation => ({
          id: String(row.id),
          organizationId: String(row.organization_id),
          participantIds: asJson(row.participant_ids),
          kind: row.kind as Conversation['kind'],
        }),
      ),
    )

    const messages = await this.sql.query<Record<string, unknown>>('SELECT * FROM messages')
    db.messages.push(
      ...messages.rows.map(
        (row): Message => ({
          id: String(row.id),
          conversationId: String(row.conversation_id),
          authorId: String(row.author_id),
          body: String(row.body),
          createdAt: String(row.created_at),
        }),
      ),
    )

    const audit = await this.sql.query<Record<string, unknown>>('SELECT * FROM audit_entries')
    db.audit.push(
      ...audit.rows.map(
        (row): AuditEntry => ({
          id: String(row.id),
          organizationId: String(row.organization_id),
          actorId: String(row.actor_id),
          action: String(row.action),
          permission: row.permission ? String(row.permission) : null,
          reason: String(row.reason),
          at: String(row.at),
        }),
      ),
    )

    const integrations = await this.sql.query<Record<string, unknown>>('SELECT * FROM integrations')
    db.integrations.push(
      ...integrations.rows.map(
        (row): Integration => ({
          id: String(row.id),
          organizationId: String(row.organization_id),
          provider: row.provider as Integration['provider'],
          status: row.status as Integration['status'],
        }),
      ),
    )

    return db
  }

  async save(db: AtlasDatabase): Promise<void> {
    await this.ensureSchema()
    await this.sql.tx(async (sql) => {
      await sql.exec(`
        TRUNCATE TABLE
          messages,
          conversations,
          audit_entries,
          integrations,
          meetings,
          documents,
          decisions,
          tasks,
          agent_relations,
          agents,
          departments,
          organizations,
          accounts,
          users
        RESTART IDENTITY CASCADE
      `)

      for (const user of db.users.values()) {
        await sql.query('INSERT INTO users (id, name, email) VALUES ($1, $2, $3)', [
          user.id,
          user.name,
          user.email,
        ])
        const account = this.accounts.get(user.id)
        if (!account) continue
        await sql.query(
          'INSERT INTO accounts (user_id, password_hash, organization_name) VALUES ($1, $2, $3)',
          [user.id, account.passwordHash, account.organizationName],
        )
      }

      for (const organization of db.organizations.values()) {
        await sql.query(
          'INSERT INTO organizations (id, owner_id, name, intention, objective) VALUES ($1, $2, $3, $4, $5)',
          [organization.id, organization.ownerId, organization.name, organization.intention, organization.objective],
        )
      }

      for (const department of db.departments.values()) {
        await sql.query('INSERT INTO departments (id, organization_id, name) VALUES ($1, $2, $3)', [
          department.id,
          department.organizationId,
          department.name,
        ])
      }

      for (const agent of db.agents.values()) {
        await sql.query(
          `INSERT INTO agents (
            id, organization_id, department_id, reports_to_id, first_name, last_name, role, mission,
            presence, personality, skills, objectives, tool_ids, permissions, delegation, avatar
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15, $16::jsonb
          )`,
          [
            agent.id,
            agent.organizationId,
            agent.departmentId,
            agent.reportsToId,
            agent.firstName,
            agent.lastName,
            agent.role,
            agent.mission,
            agent.presence,
            JSON.stringify(agent.personality),
            JSON.stringify(agent.skills),
            JSON.stringify(agent.objectives),
            JSON.stringify(agent.toolIds),
            JSON.stringify(agent.permissions),
            agent.delegation,
            JSON.stringify(agent.avatar),
          ],
        )
      }

      for (const task of db.tasks) {
        await sql.query(
          'INSERT INTO tasks (id, organization_id, agent_id, title, status, mission_id) VALUES ($1, $2, $3, $4, $5, $6)',
          [task.id, task.organizationId, task.agentId, task.title, task.status, task.missionId],
        )
      }

      for (const decision of db.decisions) {
        await sql.query(
          `INSERT INTO decisions (
            id, organization_id, requested_by_agent_id, title, summary, amount, risk, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            decision.id,
            decision.organizationId,
            decision.requestedByAgentId,
            decision.title,
            decision.summary,
            decision.amount,
            decision.risk,
            decision.status,
          ],
        )
      }

      for (const document of db.documents) {
        await sql.query(
          'INSERT INTO documents (id, organization_id, name, mime_type, accessible_to) VALUES ($1, $2, $3, $4, $5::jsonb)',
          [document.id, document.organizationId, document.name, document.mimeType, JSON.stringify(document.accessibleTo)],
        )
      }

      for (const meeting of db.meetings) {
        await sql.query(
          'INSERT INTO meetings (id, organization_id, title, starts_at, created_by_agent_id, agenda) VALUES ($1, $2, $3, $4, $5, $6::jsonb)',
          [
            meeting.id,
            meeting.organizationId,
            meeting.title,
            meeting.startsAt,
            meeting.createdByAgentId,
            JSON.stringify(meeting.agenda),
          ],
        )
      }

      for (const conversation of db.conversations) {
        await sql.query(
          'INSERT INTO conversations (id, organization_id, participant_ids, kind) VALUES ($1, $2, $3::jsonb, $4)',
          [conversation.id, conversation.organizationId, JSON.stringify(conversation.participantIds), conversation.kind],
        )
      }

      for (const message of db.messages) {
        await sql.query(
          'INSERT INTO messages (id, conversation_id, author_id, body, created_at) VALUES ($1, $2, $3, $4, $5)',
          [message.id, message.conversationId, message.authorId, message.body, message.createdAt],
        )
      }

      for (const entry of db.audit) {
        await sql.query(
          'INSERT INTO audit_entries (id, organization_id, actor_id, action, permission, reason, at) VALUES ($1, $2, $3, $4, $5, $6, $7)',
          [entry.id, entry.organizationId, entry.actorId, entry.action, entry.permission, entry.reason, entry.at],
        )
      }

      for (const integration of db.integrations) {
        await sql.query(
          'INSERT INTO integrations (id, organization_id, provider, status) VALUES ($1, $2, $3, $4)',
          [integration.id, integration.organizationId, integration.provider, integration.status],
        )
      }

      for (const relation of db.relations) {
        await sql.query(
          'INSERT INTO agent_relations (id, organization_id, from_agent_id, to_agent_id, kind) VALUES ($1, $2, $3, $4, $5)',
          [relation.id, relation.organizationId, relation.fromAgentId, relation.toAgentId, relation.kind],
        )
      }
    })
  }
}
