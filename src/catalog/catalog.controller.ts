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

  // NOTE: `advertisement/list` is intentionally handled by
  // CatalogExtrasController instead — that version enriches each ad with the
  // restaurant name/logo, falls back the cover/profile image to the
  // restaurant's own images, filters out ads for inactive restaurants, and
  // sets restaurant_status. A duplicate route here would shadow it (NestJS
  // matches the first-registered handler) and the home highlight card would
  // show a grey box + "Restaurant is not available".
}
