import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogRouterService } from './catalog-router.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogRouterService) {}

  @Get('zone/list')
  zones() {
    return this.catalog.listZones();
  }

  // Lenient parse — a missing / non-numeric lat-lng must not 400 (that breaks
  // zone detection app-wide). Invalid coords still resolve to a default zone
  // via the service (so the app always has a usable zone).
  @Get('zone/check')
  checkZone(@Query('lat') latStr?: string, @Query('lng') lngStr?: string) {
    return this.catalog.checkZone(Number(latStr), Number(lngStr));
  }

  @Get('categories')
  categories() {
    return this.catalog.listCategories();
  }

  @Get('categories/childes/:parentId')
  childCategories(@Param('parentId') parentIdStr: string) {
    return this.catalog.listChildCategories(parseInt(parentIdStr, 10) || 0);
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
