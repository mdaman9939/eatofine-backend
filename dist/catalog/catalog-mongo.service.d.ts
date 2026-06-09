import { Model } from 'mongoose';
import { CategoryDocument } from '../mongo/schemas/category.schema';
import { CuisineDocument } from '../mongo/schemas/cuisine.schema';
import { BannerDocument } from '../mongo/schemas/banner.schema';
import { MongoDataService } from '../mongo/mongo-data.service';
export declare class CatalogMongoService {
    private readonly categoryModel;
    private readonly cuisineModel;
    private readonly bannerModel;
    private readonly mongo;
    constructor(categoryModel: Model<CategoryDocument>, cuisineModel: Model<CuisineDocument>, bannerModel: Model<BannerDocument>, mongo: MongoDataService);
    private fullUrl;
    listCategories(): Promise<{
        id: number | undefined;
        name: string | undefined;
        image: string | undefined;
        image_full_url: string | null;
        parent_id: number;
        childes_count: number;
        position: number;
        priority: number;
        status: number;
    }[]>;
    listChildCategories(parentId: number): Promise<{
        id: number | undefined;
        name: string | undefined;
        image: string | undefined;
        image_full_url: string | null;
        parent_id: number;
        position: number;
        priority: number;
        status: number;
    }[]>;
    listBanners(): Promise<{
        campaigns: never[];
        banners: {
            id: number | undefined;
            title: string | undefined;
            type: string | undefined;
            image: string | undefined;
            image_full_url: string | null;
            data: unknown;
            zone_id: number | undefined;
            status: number;
        }[];
    }>;
    listCuisines(): Promise<{
        id: number | undefined;
        name: string | undefined;
        image: string | undefined;
        image_full_url: string | null;
        status: number;
    }[]>;
    listZones(): Promise<{
        id: number;
        name: string | null;
        coordinates: {
            lat: number;
            lng: number;
        }[] | null;
        status: number;
    }[]>;
    checkZone(lat: number, lng: number): Promise<{
        zone_id: number[];
        zone_data: {
            id: number;
            name: string | null;
        }[];
    }>;
    listCurrencies(): Promise<{
        id: number;
        country: string | null;
        currency_code: string | null;
        currency_symbol: string | null;
        exchange_rate: string | number | null;
    }[]>;
    listAdvertisements(): Promise<{
        id: number;
        title: string | null;
        description: string | null;
        status: string | null;
    }[]>;
}
