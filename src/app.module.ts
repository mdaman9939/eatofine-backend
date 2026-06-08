import { Module } from '@nestjs/common';
import { ConfigModule as NestConfig } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { BusinessSettingsModule } from './business-settings/business-settings.module';
import { ConfigModule } from './config/config.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/auth.guard';
import { CatalogModule } from './catalog/catalog.module';
import { BrowseModule } from './browse/browse.module';
import { CustomerModule } from './customer/customer.module';
import { OrderModule } from './order/order.module';
import { OpsModule } from './ops/ops.module';
import { AdminModule } from './admin/admin.module';
import { ExtrasModule } from './extras/extras.module';
import { EnhancementsModule } from './enhancements/enhancements.module';
import { DocumentsModule } from './documents/documents.module';
import { CompletionModule } from './completion/completion.module';
import { RefundModule } from './refund/refund.module';
import { MongoModule } from './mongo/mongo.module';
import { MigrationModule } from './mongo/migration.module';

@Module({
  imports: [
    NestConfig.forRoot({ isGlobal: true }),
    // Two throttler buckets: a permissive global default + an `auth` bucket
    // for login/signup. The default is intentionally generous — the apps are
    // chatty (search-as-you-type + 10–15 calls per screen), so a low cap shows
    // up as "Too Many Requests" during normal use. Tune via env if needed.
    //
    //   THROTTLE_LIMIT       (default 2000) requests per IP per window
    //   THROTTLE_TTL         (default 60000 ms = 1 min)  window
    //   AUTH_THROTTLE_LIMIT  (default 30) login/signup attempts per IP
    //   AUTH_THROTTLE_TTL    (default 300000 ms = 5 min)  window
    //
    // For hardened production, lower THROTTLE_LIMIT and AUTH_THROTTLE_LIMIT.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '2000', 10),
      },
      {
        name: 'auth',
        ttl: parseInt(process.env.AUTH_THROTTLE_TTL ?? '300000', 10),
        limit: parseInt(process.env.AUTH_THROTTLE_LIMIT ?? '30', 10),
      },
    ]),
    PrismaModule,
    BusinessSettingsModule,
    AuthModule,
    ConfigModule,
    CatalogModule,
    BrowseModule,
    CustomerModule,
    OrderModule,
    OpsModule,
    AdminModule,
    ExtrasModule,
    EnhancementsModule,
    DocumentsModule,
    CompletionModule,
    RefundModule,
    MongoModule,
    MigrationModule,
  ],
  controllers: [AppController],
  providers: [
    // Throttler runs before AuthGuard — abusive clients hit rate-limit
    // before we waste cycles validating their JWT.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
