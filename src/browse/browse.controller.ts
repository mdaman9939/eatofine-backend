import { Controller, Get, NotFoundException, Param, Query } from '@nestjs/common';
import { BrowseService } from './browse.service';

const parseZoneIdHeader = (raw: string | string[] | undefined): number | undefined => {
  if (!raw) return undefined;
  const v = Array.isArray(raw) ? raw[0] : raw;
  try {
    const parsed = JSON.parse(v);
    if (Array.isArray(parsed) && parsed.length > 0) return Number(parsed[0]);
    if (typeof parsed === 'number') return parsed;
  } catch {
    const n = parseInt(v, 10);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
};

@Controller()
export class BrowseController {
  constructor(private readonly browse: BrowseService) {}

  @Get('restaurants/get-restaurants/:filterData')
  async restaurantsList(
    @Param('filterData') filter: string,
    @Query('limit') limit: string = '10',
    @Query('offset') offset: string = '1',
  ) {
    return this.browse.getRestaurants({
      limit: parseInt(limit, 10) || 10,
      offset: parseInt(offset, 10) || 1,
      filter,
    });
  }

  @Get('restaurants/latest')
  restaurantsLatest(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.browse.getRestaurantsLatest(undefined, parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
  }

  @Get('restaurants/popular')
  restaurantsPopular(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.browse.getRestaurantsPopular(undefined, parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
  }

  @Get('restaurants/details/:id')
  async restaurantDetails(@Param('id') id: string) {
    // Accept a numeric id OR a slug — the app sends whichever it has, so a
    // non-numeric value must NOT 400 (that froze the detail screen).
    const result = await this.browse.getRestaurantDetails(id);
    if (!result) throw new NotFoundException({ errors: [{ code: 'restaurant_id', message: 'not_found' }] });
    return result;
  }

  @Get('products/latest')
  productsLatest(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.browse.getProductsLatest(undefined, parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
  }

  @Get('products/popular')
  productsPopular(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.browse.getProductsPopular(undefined, parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
  }

  @Get('products/recommended')
  productsRecommended(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.browse.getProductsRecommended(undefined, parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
  }

  @Get('products/most-reviewed')
  productsMostReviewed(@Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.browse.getProductsMostReviewed(undefined, parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
  }

  @Get('products/details/:id')
  async productDetails(@Param('id') idStr: string) {
    const id = parseInt(idStr, 10);
    if (!Number.isFinite(id)) throw new NotFoundException({ errors: [{ code: 'food_id', message: 'not_found' }] });
    const result = await this.browse.getProductDetails(id);
    if (!result) throw new NotFoundException({ errors: [{ code: 'food_id', message: 'not_found' }] });
    return result;
  }

  @Get('categories/products/:categoryId')
  categoryProducts(
    @Param('categoryId') categoryIdStr: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.browse.getCategoryProducts(parseInt(categoryIdStr, 10) || 0, parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
  }

  @Get('categories/restaurants/:categoryId')
  categoryRestaurants(
    @Param('categoryId') categoryIdStr: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const categoryId = parseInt(categoryIdStr, 10) || 0;
    return this.browse.getCategoryRestaurants(categoryId, parseInt(limit ?? '10', 10), parseInt(offset ?? '1', 10));
  }
}

// Re-exported for typing only; keep TS happy when imports change.
export { parseZoneIdHeader };
