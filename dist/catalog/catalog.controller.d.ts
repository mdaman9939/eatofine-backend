import { CatalogRouterService } from './catalog-router.service';
export declare class CatalogController {
    private readonly catalog;
    constructor(catalog: CatalogRouterService);
    zones(): Promise<{
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
    checkZone(latStr?: string, lngStr?: string): Promise<{
        zone_id: number[];
        zone_data: {
            id: number;
            name: string | null;
        }[];
    }>;
    categories(): Promise<{
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
    childCategories(parentIdStr: string): Promise<{
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
    banners(): Promise<{
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
    cuisines(): Promise<{
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
    currencies(): Promise<{
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
}
