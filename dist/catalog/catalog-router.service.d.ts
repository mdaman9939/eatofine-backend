import { CatalogService } from './catalog.service';
import { CatalogMongoService } from './catalog-mongo.service';
export declare class CatalogRouterService {
    private readonly mysql;
    private readonly mongo;
    private readonly log;
    constructor(mysql: CatalogService, mongo: CatalogMongoService);
    private useMongo;
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
    }[]> | Promise<{
        id: bigint;
        name: string;
        image: string;
        image_full_url: string | null;
        parent_id: number;
        position: number;
        status: number;
        slug: string | null;
        childes_count: number;
        products_count: number;
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
    }[]> | Promise<{
        id: bigint;
        name: string;
        image: string;
        image_full_url: string | null;
        parent_id: number;
        position: number;
        status: number;
        slug: string | null;
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
    }> | Promise<{
        campaigns: never[];
        banners: {
            id: bigint;
            title: string;
            type: string;
            image: string | null;
            image_full_url: string | null;
            data: string;
            zone_id: bigint;
            status: number;
        }[];
    }>;
    listCuisines(): Promise<{
        id: number | undefined;
        name: string | undefined;
        image: string | undefined;
        image_full_url: string | null;
        status: number;
    }[]> | Promise<{
        id: bigint;
        name: string;
        image: string | null;
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
    }[]> | Promise<{
        id: number;
        name: string;
        coordinates: any;
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
    }[]> | Promise<{
        id: bigint;
        country: string | null;
        currency_code: string | null;
        currency_symbol: string | null;
        exchange_rate: import("@prisma/client/runtime/library").Decimal | null;
    }[]>;
    listAdvertisements(): Promise<{
        id: number;
        title: string | null;
        description: string | null;
        status: string | null;
    }[]> | Promise<{
        id: bigint;
        title: string | null;
        description: string | null;
        status: string;
    }[]>;
}
