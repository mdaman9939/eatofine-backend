import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MigrationController } from './migration.controller';
import { MigrationService } from './migration.service';
import { GenericMigrationService } from './generic-migration.service';
import { MongoDataService } from './mongo-data.service';
import { SeedService } from './seed.service';
import { User, UserSchema } from './schemas/user.schema';
import { Vendor, VendorSchema } from './schemas/vendor.schema';
import { Restaurant, RestaurantSchema } from './schemas/restaurant.schema';
import { Food, FoodSchema } from './schemas/food.schema';
import { DeliveryMan, DeliveryManSchema } from './schemas/delivery-man.schema';
import { Order, OrderSchema } from './schemas/order.schema';
import { Category, CategorySchema } from './schemas/category.schema';
import { Cuisine, CuisineSchema } from './schemas/cuisine.schema';
import { Banner, BannerSchema } from './schemas/banner.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Vendor.name, schema: VendorSchema },
      { name: Restaurant.name, schema: RestaurantSchema },
      { name: Food.name, schema: FoodSchema },
      { name: DeliveryMan.name, schema: DeliveryManSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Cuisine.name, schema: CuisineSchema },
      { name: Banner.name, schema: BannerSchema },
    ]),
  ],
  controllers: [MigrationController],
  providers: [MigrationService, GenericMigrationService, MongoDataService, SeedService],
  exports: [MongooseModule, MigrationService, GenericMigrationService, MongoDataService, SeedService],
})
export class MigrationModule {}
