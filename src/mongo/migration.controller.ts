import { Body, Controller, Delete, Get, HttpCode, Param, Post } from '@nestjs/common';
import { RequireAuth } from '../auth/auth.guard';
import { MigrationService } from './migration.service';
import { GenericMigrationService } from './generic-migration.service';
import { SeedService } from './seed.service';

@Controller('admin/mongo')
@RequireAuth('admin')
export class MigrationController {
  constructor(
    private readonly svc: MigrationService,
    private readonly generic: GenericMigrationService,
    private readonly seed: SeedService,
  ) {}

  /** Seed realistic Indian demo data across all major collections. */
  @Post('seed-demo')
  @HttpCode(200)
  seedDemo() {
    return this.seed.seedAll();
  }

  /** Quick health check — counts on each MongoDB collection. */
  @Get('counts')
  counts() {
    return this.svc.counts();
  }

  /** Migrate everything. Idempotent — safe to re-run. */
  @Post('migrate-all')
  @HttpCode(200)
  migrateAll() {
    return this.svc.runAll();
  }

  @Post('migrate-users')
  @HttpCode(200)
  migrateUsers() {
    return this.svc.migrateUsers();
  }

  @Post('migrate-vendors')
  @HttpCode(200)
  migrateVendors() {
    return this.svc.migrateVendors();
  }

  @Post('migrate-delivery-men')
  @HttpCode(200)
  migrateDeliveryMen() {
    return this.svc.migrateDeliveryMen();
  }

  @Post('migrate-restaurants')
  @HttpCode(200)
  migrateRestaurants() {
    return this.svc.migrateRestaurants();
  }

  @Post('migrate-foods')
  @HttpCode(200)
  migrateFoods() {
    return this.svc.migrateFoods();
  }

  @Post('migrate-orders')
  @HttpCode(200)
  migrateOrders() {
    return this.svc.migrateOrders();
  }

  @Post('migrate-categories')
  @HttpCode(200)
  migrateCategories() {
    return this.svc.migrateCategories();
  }

  @Post('migrate-cuisines')
  @HttpCode(200)
  migrateCuisines() {
    return this.svc.migrateCuisines();
  }

  @Post('migrate-banners')
  @HttpCode(200)
  migrateBanners() {
    return this.svc.migrateBanners();
  }

  // ── Generic table migration (for the remaining 150+ MySQL tables) ──

  /** Migrate every MySQL table to MongoDB.
   *  - include_typed: also overwrite the 9 typed collections (users, vendors, etc.)
   *  - include_system: also migrate framework internals (cache, oauth_*, sessions)
   *  By default the empty MongoDB collections ARE created even when the
   *  source MySQL table has 0 rows. */
  @Post('migrate-all-tables')
  @HttpCode(200)
  migrateAllTables(@Body() body: { include_typed?: boolean; include_system?: boolean } = {}) {
    return this.generic.migrateAllTables({
      includeTyped: !!body.include_typed,
      includeSystem: !!body.include_system,
    });
  }

  /** Migrate a single table by name. */
  @Post('migrate-table/:table')
  @HttpCode(200)
  migrateOneTable(@Param('table') table: string) {
    return this.generic.migrateTable(table);
  }

  /** List all MySQL tables in the current database. */
  @Get('mysql-tables')
  listMysqlTables() {
    return this.generic.listMysqlTables();
  }

  /** List all MongoDB collections with row counts. */
  @Get('mongo-collections')
  listMongoCollections() {
    return this.generic.listMongoCollections();
  }

  /** Drop a MongoDB collection (re-run migrations after this). */
  @Delete('collection/:name')
  @HttpCode(200)
  dropCollection(@Param('name') name: string) {
    return this.generic.dropCollection(name);
  }
}
