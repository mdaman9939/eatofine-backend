import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { CatalogMongoService } from './catalog-mongo.service';
import { CatalogRouterService } from './catalog-router.service';
import { Category, CategorySchema } from '../mongo/schemas/category.schema';
import { Cuisine, CuisineSchema } from '../mongo/schemas/cuisine.schema';
import { Banner, BannerSchema } from '../mongo/schemas/banner.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Category.name, schema: CategorySchema },
      { name: Cuisine.name, schema: CuisineSchema },
      { name: Banner.name, schema: BannerSchema },
    ]),
  ],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogMongoService, CatalogRouterService],
})
export class CatalogModule {}
