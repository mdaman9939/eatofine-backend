import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Generic MySQL → MongoDB table migrator.
 *
 * Dumps any MySQL table to a same-named MongoDB collection without needing
 * a Mongoose schema. Each row becomes one document with:
 *   - all original columns preserved as fields
 *   - `mysql_id` set to the row's primary key (if `id` column exists)
 *   - BigInt / Buffer / Date values normalised to plain JS types
 *
 * This is the "fallback" path for the ~150 long-tail tables in the schema.
 * Tables that have typed Mongoose schemas (users, vendors, restaurants,
 * foods, orders, delivery_men, categories, cuisines, banners) should keep
 * using their dedicated migration methods.
 */
@Injectable()
export class GenericMigrationService {
  private readonly log = new Logger('GenericMigration');

  // Tables we deliberately skip — framework internals or transient state
  // that doesn't belong in the long-term datastore.
  private readonly SKIP_TABLES = new Set([
    'migrations',
    'cache',
    'cache_locks',
    'failed_jobs',
    'password_resets',
    'oauth_access_tokens',
    'oauth_auth_codes',
    'oauth_clients',
    'oauth_personal_access_clients',
    'oauth_refresh_tokens',
    'websockets_statistics_entries',
    'phone_verifications',
    'email_verifications',
    'recent_searches',
    'logs',
    'time_logs',
    'track_deliverymen',
    'visitor_logs',
    'storages',
  ]);

  // Tables that have a dedicated typed migration. We skip these in the
  // generic loop so we don't overwrite the structured data with a raw dump.
  private readonly TYPED_TABLES = new Set([
    'users',
    'vendors',
    'restaurants',
    'food',
    'orders',
    'delivery_men',
    'categories',
    'cuisines',
    'banners',
  ]);

  constructor(
    private readonly prisma: PrismaService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /** List every base table in the current MySQL database. */
  async listMysqlTables(): Promise<string[]> {
    const rows = await this.prisma.$queryRawUnsafe<Array<Record<string, string>>>(
      `SELECT table_name AS name
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
       ORDER BY table_name`,
    );
    return rows.map((r) => r.name);
  }

  /** Migrate ONE table. Idempotent — uses upsert on `mysql_id`.
   *  Always creates the MongoDB collection, even if MySQL has 0 rows. */
  async migrateTable(tableName: string): Promise<{
    table: string;
    inserted: number;
    skipped: number;
    mysql_count: number;
    errors: string[];
    empty_collection_created?: boolean;
  }> {
    const errors: string[] = [];
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      throw new Error(`Invalid table name: ${tableName}`);
    }
    const rows = await this.prisma
      .$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM \`${tableName}\``)
      .catch((e: unknown) => {
        errors.push((e as Error).message);
        return [] as Array<Record<string, unknown>>;
      });

    if (!this.connection.db) {
      throw new Error('MongoDB connection not ready');
    }
    const db = this.connection.db;
    const coll = db.collection(tableName);
    let inserted = 0;
    let skipped = 0;
    let emptyCollectionCreated = false;

    // If MySQL has no rows, still create the empty MongoDB collection so
    // every table is represented 1:1 in Atlas (the user explicitly asked).
    if (rows.length === 0) {
      try {
        const existing = await db.listCollections({ name: tableName }).toArray();
        if (existing.length === 0) {
          await db.createCollection(tableName);
          emptyCollectionCreated = true;
        }
      } catch (e: unknown) {
        errors.push(`createCollection: ${(e as Error).message}`);
      }
      return {
        table: tableName,
        inserted: 0,
        skipped: 0,
        mysql_count: 0,
        errors,
        empty_collection_created: emptyCollectionCreated,
      };
    }

    for (const r of rows) {
      const doc = this.normaliseRow(r);
      const mysqlId = doc.mysql_id;
      try {
        if (mysqlId !== undefined && mysqlId !== null) {
          await coll.updateOne(
            { mysql_id: mysqlId },
            { $set: doc },
            { upsert: true },
          );
        } else {
          await coll.insertOne(doc);
        }
        inserted++;
      } catch (e: unknown) {
        skipped++;
        errors.push(`row mysql_id=${String(mysqlId)}: ${(e as Error).message}`);
      }
    }
    return { table: tableName, inserted, skipped, mysql_count: rows.length, errors };
  }

  /** Migrate ALL tables.
   *  By default skips typed-already-migrated tables and a small system
   *  blocklist. Pass `includeSystem: true` to include every single table,
   *  including framework internals.
   */
  async migrateAllTables(opts: {
    includeTyped?: boolean;
    includeSystem?: boolean;
  } = {}): Promise<{
    started_at: string;
    finished_at: string;
    duration_ms: number;
    summary: Array<{
      table: string;
      inserted: number;
      skipped: number;
      mysql_count: number;
      error_count: number;
      empty: boolean;
    }>;
    total_documents: number;
    total_collections: number;
    empty_collections_created: number;
    skipped_tables: string[];
  }> {
    const start = new Date();
    const allTables = await this.listMysqlTables();
    const summary: Array<{
      table: string;
      inserted: number;
      skipped: number;
      mysql_count: number;
      error_count: number;
      empty: boolean;
    }> = [];
    const skippedTables: string[] = [];
    let totalInserted = 0;
    let emptyCollectionsCreated = 0;

    for (const table of allTables) {
      if (!opts.includeSystem && this.SKIP_TABLES.has(table)) {
        skippedTables.push(`${table} (system)`);
        continue;
      }
      if (!opts.includeTyped && this.TYPED_TABLES.has(table)) {
        skippedTables.push(`${table} (typed migration exists)`);
        continue;
      }
      try {
        this.log.log(`Migrating ${table}...`);
        const result = await this.migrateTable(table);
        summary.push({
          table: result.table,
          inserted: result.inserted,
          skipped: result.skipped,
          mysql_count: result.mysql_count,
          error_count: result.errors.length,
          empty: result.mysql_count === 0,
        });
        totalInserted += result.inserted;
        if (result.empty_collection_created) emptyCollectionsCreated++;
        const tail = result.mysql_count === 0
          ? '(empty — collection created)'
          : `${result.inserted}/${result.mysql_count} inserted${result.errors.length ? ` (${result.errors.length} errors)` : ''}`;
        this.log.log(`${table}: ${tail}`);
      } catch (e: unknown) {
        this.log.error(`${table} FAILED: ${(e as Error).message}`);
        summary.push({ table, inserted: 0, skipped: 0, mysql_count: 0, error_count: 1, empty: false });
      }
    }

    const end = new Date();
    return {
      started_at: start.toISOString(),
      finished_at: end.toISOString(),
      duration_ms: end.getTime() - start.getTime(),
      summary,
      total_documents: totalInserted,
      total_collections: summary.length,
      empty_collections_created: emptyCollectionsCreated,
      skipped_tables: skippedTables,
    };
  }

  /** Drop one collection (use carefully). */
  async dropCollection(name: string): Promise<{ ok: boolean }> {
    if (!this.connection.db) throw new Error('MongoDB connection not ready');
    if (!/^[a-zA-Z0-9_]+$/.test(name)) throw new Error('Invalid collection name');
    await this.connection.db.collection(name).drop().catch(() => undefined);
    return { ok: true };
  }

  /** List MongoDB collections + their document counts. */
  async listMongoCollections(): Promise<Array<{ name: string; count: number }>> {
    if (!this.connection.db) throw new Error('MongoDB connection not ready');
    const collections = await this.connection.db.listCollections().toArray();
    const results: Array<{ name: string; count: number }> = [];
    for (const c of collections) {
      const count = await this.connection.db.collection(c.name).countDocuments();
      results.push({ name: c.name, count });
    }
    results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }

  /** Convert MySQL row values to MongoDB-safe JS types. */
  private normaliseRow(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined) {
        out[k] = null;
      } else if (typeof v === 'bigint') {
        // BigInt is not JSON-serialisable and MongoDB driver doesn't accept it
        const asNum = Number(v);
        out[k] = Number.isSafeInteger(asNum) ? asNum : String(v);
      } else if (v instanceof Date) {
        out[k] = v;
      } else if (Buffer.isBuffer(v)) {
        out[k] = v.toString('utf8');
      } else if (typeof v === 'string') {
        // Auto-detect JSON columns (Laravel stores arrays as JSON strings)
        const trimmed = v.trim();
        if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
            (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
          try {
            out[k] = JSON.parse(trimmed);
            continue;
          } catch {
            // not valid JSON, keep as string
          }
        }
        out[k] = v;
      } else {
        out[k] = v;
      }
    }
    // Set mysql_id from `id` if present
    if (out.id !== undefined && out.id !== null) {
      out.mysql_id = out.id;
    }
    return out;
  }
}
