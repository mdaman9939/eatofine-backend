import { PrismaService } from '../prisma/prisma.service';
export declare class CatalogService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    private storageBase;
    fullUrl(folder: string, file?: string | null): string | null;
    listZones(): Promise<{
        id: number;
        name: string;
        coordinates: any;
        status: number;
    }[]>;
    checkZone(lat: number, lng: number): Promise<{
        zone_id: number[];
        zone_data: {
            id: number;
            name: string;
        }[];
    }>;
    listCategories(): Promise<{
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
        id: bigint;
        name: string;
        image: string | null;
        image_full_url: string | null;
        status: number;
    }[]>;
    listCurrencies(): Promise<{
        id: bigint;
        country: string | null;
        currency_code: string | null;
        currency_symbol: string | null;
        exchange_rate: import("@prisma/client/runtime/library").Decimal | null;
    }[]>;
    listAdvertisements(): Promise<{
        id: bigint;
        title: string | null;
        description: string | null;
        status: string;
    }[]>;
}
