import { MigrationService } from './migration.service';
import { GenericMigrationService } from './generic-migration.service';
export declare class MigrationController {
    private readonly svc;
    private readonly generic;
    constructor(svc: MigrationService, generic: GenericMigrationService);
    counts(): Promise<{
        users: number;
        vendors: number;
        delivery_men: number;
        restaurants: number;
        foods: number;
        orders: number;
        categories: number;
        cuisines: number;
        banners: number;
    }>;
    migrateAll(): Promise<import("./migration.service").MigrationReport>;
    migrateUsers(): Promise<import("./migration.service").MigrationStep>;
    migrateVendors(): Promise<import("./migration.service").MigrationStep>;
    migrateDeliveryMen(): Promise<import("./migration.service").MigrationStep>;
    migrateRestaurants(): Promise<import("./migration.service").MigrationStep>;
    migrateFoods(): Promise<import("./migration.service").MigrationStep>;
    migrateOrders(): Promise<import("./migration.service").MigrationStep>;
    migrateCategories(): Promise<import("./migration.service").MigrationStep>;
    migrateCuisines(): Promise<import("./migration.service").MigrationStep>;
    migrateBanners(): Promise<import("./migration.service").MigrationStep>;
    migrateAllTables(body?: {
        include_typed?: boolean;
        include_system?: boolean;
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
    migrateOneTable(table: string): Promise<{
        table: string;
        inserted: number;
        skipped: number;
        mysql_count: number;
        errors: string[];
        empty_collection_created?: boolean;
    }>;
    listMysqlTables(): Promise<string[]>;
    listMongoCollections(): Promise<{
        name: string;
        count: number;
    }[]>;
    dropCollection(name: string): Promise<{
        ok: boolean;
    }>;
}
