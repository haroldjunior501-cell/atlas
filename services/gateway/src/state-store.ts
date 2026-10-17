import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { BlobServiceClient } from '@azure/storage-blob'
import {
  createDatabase,
  databaseFromSnapshot,
  snapshotDatabase,
  type AtlasDatabase,
  type CloudSnapshot,
} from '@atlas/orchestrator'
import { pgSession, PostgresState, type AccountRecord } from './postgres-state'

const CONTAINER = 'atlas-organizations'
const BLOB = 'state.json'
const ACCOUNTS_BLOB = 'accounts.json'

export interface CloudState {
  /** `postgres` is the database. `azure` is the blob fallback. `local` is a file on this machine. */
  runtime: 'postgres' | 'azure' | 'local'
  load(): Promise<AtlasDatabase>
  save(db: AtlasDatabase): Promise<void>
  rememberAccount?(userId: string, passwordHash: string, organizationName: string): void
  accountFor?(email: string, users: Iterable<{ id: string; email: string }>): AccountRecord | undefined
}

type AccountFile = Record<string, AccountRecord>

export function createCloudState(
  env: NodeJS.ProcessEnv = process.env,
): CloudState {
  const database = env.DATABASE_URL?.trim()
  if (database) return new PostgresState(pgSession(database))
  const connection = env.AZURE_STORAGE_CONNECTION_STRING?.trim()
  if (connection) return new AzureBlobState(connection)
  return new LocalFileState(env.ATLAS_STATE_DIR?.trim() || 'data')
}

abstract class AccountBook {
  protected accounts = new Map<string, AccountRecord>()

  rememberAccount(userId: string, passwordHash: string, organizationName: string): void {
    this.accounts.set(userId, { passwordHash, organizationName })
  }

  accountFor(email: string, users: Iterable<{ id: string; email: string }>): AccountRecord | undefined {
    const user = [...users].find((item) => item.email.toLowerCase() === email.toLowerCase())
    if (!user) return undefined
    return this.accounts.get(user.id)
  }

  protected hydrateAccounts(raw: AccountFile | null | undefined) {
    this.accounts.clear()
    for (const [userId, account] of Object.entries(raw || {})) {
      if (account?.passwordHash && account.organizationName) {
        this.accounts.set(userId, {
          passwordHash: account.passwordHash,
          organizationName: account.organizationName,
        })
      }
    }
  }

  protected serializeAccounts(): AccountFile {
    return Object.fromEntries(this.accounts.entries())
  }
}

class LocalFileState extends AccountBook implements CloudState {
  readonly runtime = 'local' as const

  constructor(private readonly directory: string) {
    super()
  }

  async load(): Promise<AtlasDatabase> {
    try {
      const text = await readFile(this.file, 'utf8')
      const accountsText = await readFile(this.accountsFile, 'utf8').catch(() => '{}')
      this.hydrateAccounts(JSON.parse(accountsText) as AccountFile)
      return databaseFromSnapshot(JSON.parse(text) as CloudSnapshot)
    } catch {
      this.accounts.clear()
      return createDatabase()
    }
  }

  async save(db: AtlasDatabase): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true })
    await writeFile(this.file, JSON.stringify(snapshotDatabase(db)))
    await writeFile(this.accountsFile, JSON.stringify(this.serializeAccounts(), null, 2))
  }

  private get file(): string {
    return join(this.directory, 'atlas-state.json')
  }

  private get accountsFile(): string {
    return join(this.directory, 'atlas-accounts.json')
  }
}

class AzureBlobState extends AccountBook implements CloudState {
  readonly runtime = 'azure' as const
  private readonly container

  constructor(connection: string) {
    super()
    this.container = BlobServiceClient.fromConnectionString(connection).getContainerClient(CONTAINER)
  }

  async load(): Promise<AtlasDatabase> {
    await this.container.createIfNotExists()
    const blob = this.container.getBlobClient(BLOB)
    if (!(await blob.exists())) {
      this.accounts.clear()
      return createDatabase()
    }
    const downloaded = await this.container.getBlockBlobClient(BLOB).downloadToBuffer()
    const accountsBlob = this.container.getBlockBlobClient(ACCOUNTS_BLOB)
    if (await accountsBlob.exists()) {
      const accountsBuf = await accountsBlob.downloadToBuffer()
      this.hydrateAccounts(JSON.parse(accountsBuf.toString('utf8')) as AccountFile)
    } else {
      this.accounts.clear()
    }
    return databaseFromSnapshot(JSON.parse(downloaded.toString('utf8')) as CloudSnapshot)
  }

  async save(db: AtlasDatabase): Promise<void> {
    await this.container.createIfNotExists()
    const body = Buffer.from(JSON.stringify(snapshotDatabase(db)))
    await this.container.getBlockBlobClient(BLOB).upload(body, body.length, {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    })
    const accountsBody = Buffer.from(JSON.stringify(this.serializeAccounts()))
    await this.container.getBlockBlobClient(ACCOUNTS_BLOB).upload(accountsBody, accountsBody.length, {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    })
  }
}
