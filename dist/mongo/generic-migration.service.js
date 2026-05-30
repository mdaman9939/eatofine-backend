"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GenericMigrationService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const prisma_service_1 = require("../prisma/prisma.service");
let GenericMigrationService = class GenericMigrationService {
    prisma;
    connection;
    log = new common_1.Logger('GenericMigration');
    SKIP_TABLES = new Set([
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
    TYPED_TABLES = new Set([
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
    constructor(prisma, connection) {
        this.prisma = prisma;
        this.connection = connection;
    }
    async listMysqlTables() {
        const rows = await this.prisma.$queryRawUnsafe(`SELECT table_name AS name
       FROM information_schema.tables
       WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
       ORDER BY table_name`);
        return rows.map((r) => r.name);
    }
    async migrateTable(tableName) {
        const errors = [];
        if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
            throw new Error(`Invalid table name: ${tableName}`);
        }
        const rows = await this.prisma
            .$queryRawUnsafe(`SELECT * FROM \`${tableName}\``)
            .catch((e) => {
            errors.push(e.message);
            return [];
        });
        if (!this.connection.db) {
            throw new Error('MongoDB connection not ready');
        }
        const db = this.connection.db;
        const coll = db.collection(tableName);
        let inserted = 0;
        let skipped = 0;
        let emptyCollectionCreated = false;
        if (rows.length === 0) {
            try {
                const existing = await db.listCollections({ name: tableName }).toArray();
                if (existing.length === 0) {
                    await db.createCollection(tableName);
                    emptyCollectionCreated = true;
                }
            }
            catch (e) {
                errors.push(`createCollection: ${e.message}`);
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
                    await coll.updateOne({ mysql_id: mysqlId }, { $set: doc }, { upsert: true });
                }
                else {
                    await coll.insertOne(doc);
                }
                inserted++;
            }
            catch (e) {
                skipped++;
                errors.push(`row mysql_id=${String(mysqlId)}: ${e.message}`);
            }
        }
        return { table: tableName, inserted, skipped, mysql_count: rows.length, errors };
    }
    async migrateAllTables(opts = {}) {
        const start = new Date();
        const allTables = await this.listMysqlTables();
        const summary = [];
        const skippedTables = [];
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
                if (result.empty_collection_created)
                    emptyCollectionsCreated++;
                const tail = result.mysql_count === 0
                    ? '(empty — collection created)'
                    : `${result.inserted}/${result.mysql_count} inserted${result.errors.length ? ` (${result.errors.length} errors)` : ''}`;
                this.log.log(`${table}: ${tail}`);
            }
            catch (e) {
                this.log.error(`${table} FAILED: ${e.message}`);
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
    async dropCollection(name) {
        if (!this.connection.db)
            throw new Error('MongoDB connection not ready');
        if (!/^[a-zA-Z0-9_]+$/.test(name))
            throw new Error('Invalid collection name');
        await this.connection.db.collection(name).drop().catch(() => undefined);
        return { ok: true };
    }
    async listMongoCollections() {
        if (!this.connection.db)
            throw new Error('MongoDB connection not ready');
        const collections = await this.connection.db.listCollections().toArray();
        const results = [];
        for (const c of collections) {
            const count = await this.connection.db.collection(c.name).countDocuments();
            results.push({ name: c.name, count });
        }
        results.sort((a, b) => a.name.localeCompare(b.name));
        return results;
    }
    normaliseRow(row) {
        const out = {};
        for (const [k, v] of Object.entries(row)) {
            if (v === null || v === undefined) {
                out[k] = null;
            }
            else if (typeof v === 'bigint') {
                const asNum = Number(v);
                out[k] = Number.isSafeInteger(asNum) ? asNum : String(v);
            }
            else if (v instanceof Date) {
                out[k] = v;
            }
            else if (Buffer.isBuffer(v)) {
                out[k] = v.toString('utf8');
            }
            else if (typeof v === 'string') {
                const trimmed = v.trim();
                if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
                    (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
                    try {
                        out[k] = JSON.parse(trimmed);
                        continue;
                    }
                    catch {
                    }
                }
                out[k] = v;
            }
            else {
                out[k] = v;
            }
        }
        if (out.id !== undefined && out.id !== null) {
            out.mysql_id = out.id;
        }
        return out;
    }
};
exports.GenericMigrationService = GenericMigrationService;
exports.GenericMigrationService = GenericMigrationService = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, mongoose_1.InjectConnection)()),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        mongoose_2.Connection])
], GenericMigrationService);
//# sourceMappingURL=generic-migration.service.js.map