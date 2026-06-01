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
import { MongoModule } from './mongo/mongo.module';
import { MigrationModule } from './mongo/migration.module';

@Module({
  imports: [
    NestConfig.forRoot({ isGlobal: true }),
    // Two throttler buckets: a permissive global default + a strict `auth`
    // bucket that login/signup endpoints opt into via @Throttle({auth: ...}).
    // Tweak via env: AUTH_THROTTLE_LIMIT (default 5) over AUTH_THROTTLE_TTL ms
    // (default 15 minutes).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 120,
      },
      {
        name: 'auth',
        ttl: parseInt(process.env.AUTH_THROTTLE_TTL ?? '900000', 10),
        limit: parseInt(process.env.AUTH_THROTTLE_LIMIT ?? '5', 10),
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
