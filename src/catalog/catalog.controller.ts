import { Controller, Get, Param, ParseFloatPipe, ParseIntPipe, Query } from '@nestjs/common';
import { CatalogRouterService } from './catalog-router.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogRouterService) {}

  @Get('zone/list')
  zones() {
    return this.catalog.listZones();
  }

  @Get('zone/check')
  checkZone(@Query('lat', ParseFloatPipe) lat: number, @Query('lng', ParseFloatPipe) lng: number) {
    return this.catalog.checkZone(lat, lng);
  }

  @Get('categories')
  categories() {
    return this.catalog.listCategories();
  }

  @Get('categories/childes/:parentId')
  childCategories(@Param('parentId', ParseIntPipe) parentId: number) {
    return this.catalog.listChildCategories(parentId);
  }

  @Get('banners')
  banners() {
    return this.catalog.listBanners();
  }

  @Get('cuisine/list')
  cuisines() {
    return this.catalog.listCuisines();
  }

  @Get('currencies')
  currencies() {
    return this.catalog.listCurrencies();
  }

  @Get('advertisement/list')
  ads() {
    return this.catalog.listAdvertisements();
  }
}
