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
    // ONE global throttler bucket. (A second named bucket here would apply to
    // EVERY route — so a strict 'auth' bucket in this array silently capped all
    // traffic. Auth routes instead override this bucket locally via @Throttle.)
    // The global default is generous — the apps are chatty (search-as-you-type,
    // order polling, 10–15 calls per screen, and a tester runs all 3 apps off
    // one IP), so a low cap shows up as "Too Many Requests" during normal use.
    //
    //   THROTTLE_LIMIT  (default 6000) requests per IP per window
    //   THROTTLE_TTL    (default 60000 ms = 1 min)  window
    //   AUTH routes are limited separately (AUTH_THROTTLE_* — see auth.controller).
    //
    // For hardened production, lower THROTTLE_LIMIT.
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
        limit: parseInt(process.env.THROTTLE_LIMIT ?? '6000', 10),
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
