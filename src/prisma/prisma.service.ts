import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Lazy Prisma client. We deliberately do NOT call `$connect()` on module
 * init — Prisma connects on the first query. With every service now routed
 * to MongoDB via the `USE_MONGO_*` flags, no Prisma call is ever made and
 * therefore no MySQL connection is ever opened at startup.
 *
 * If you set any `USE_MONGO_*` flag to "0", Prisma will connect on demand
 * the first time that flag's fallback path executes a query.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly log = new Logger('Prisma');

  constructor() {
    super({ log: ['warn', 'error'] });
    this.log.log('Prisma client created (lazy — MySQL connection deferred until first query).');
  }

  async onModuleDestroy() {
    await this.$disconnect().catch(() => undefined);
  }
}
