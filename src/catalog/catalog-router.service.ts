import { Injectable, Logger } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogMongoService } from './catalog-mongo.service';

/**
 * Routes the 4 migratable catalog endpoints to either MySQL (Prisma) or
 * MongoDB (Mongoose) based on the `USE_MONGO_CATALOG` env var.
 *
 *   USE_MONGO_CATALOG=1   → reads from MongoDB (default)
 *   anything else         → reads from MySQL
 *
 * Every endpoint (incl. zones / currencies / advertisements) now has a Mongo
 * implementation, so the whole catalog works on a MongoDB-only deployment.
 */
@Injectable()
export class CatalogRouterService {
  private readonly log = new Logger('Catalog');

  constructor(
    private readonly mysql: CatalogService,
    private readonly mongo: CatalogMongoService,
  ) {
    const flag = this.useMongo();
    this.log.log(`Catalog backend: ${flag ? 'MongoDB' : 'MySQL'}`);
  }

  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_CATALOG ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  // ── Routed methods (the 4 we migrated) ────────────────────────
  listCategories() {
    return this.useMongo() ? this.mongo.listCategories() : this.mysql.listCategories();
  }
  listChildCategories(parentId: number) {
    return this.useMongo()
      ? this.mongo.listChildCategories(parentId)
      : this.mysql.listChildCategories(parentId);
  }
  listBanners() {
    return this.useMongo() ? this.mongo.listBanners() : this.mysql.listBanners();
  }
  listCuisines() {
    return this.useMongo() ? this.mongo.listCuisines() : this.mysql.listCuisines();
  }

  // ── Zones / currencies / advertisements (now Mongo-capable too) ─────
  listZones() {
    return this.useMongo() ? this.mongo.listZones() : this.mysql.listZones();
  }
  checkZone(lat: number, lng: number) {
    return this.useMongo() ? this.mongo.checkZone(lat, lng) : this.mysql.checkZone(lat, lng);
  }
  listCurrencies() {
    return this.useMongo() ? this.mongo.listCurrencies() : this.mysql.listCurrencies();
  }
  listAdvertisements() {
    return this.useMongo() ? this.mongo.listAdvertisements() : this.mysql.listAdvertisements();
  }
}
