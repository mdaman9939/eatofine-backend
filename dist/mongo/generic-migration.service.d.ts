import { Connection } from 'mongoose';
import { PrismaService } from '../prisma/prisma.service';
export declare class GenericMigrationService {
    private readonly prisma;
    private readonly connection;
    private readonly log;
    private readonly SKIP_TABLES;
    private readonly TYPED_TABLES;
    constructor(prisma: PrismaService, connection: Connection);
    listMysqlTables(): Promise<string[]>;
    migrateTable(tableName: string): Promise<{
        table: string;
        inserted: number;
        skipped: number;
        mysql_count: number;
        errors: string[];
        empty_collection_created?: boolean;
    }>;
    migrateAllTables(opts?: {
        includeTyped?: boolean;
        includeSystem?: boolean;
    }): Promise<{
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
    }>;
    dropCollection(name: string): Promise<{
        ok: boolean;
    }>;
    listMongoCollections(): Promise<Array<{
        name: string;
        count: number;
    }>>;
    private normaliseRow;
}
