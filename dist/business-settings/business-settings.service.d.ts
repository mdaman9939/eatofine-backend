import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';
export declare class BusinessSettingsService implements OnModuleInit {
    private readonly prisma;
    private readonly mongo;
    private cache;
    private cachedAt;
    private readonly ttlMs;
    constructor(prisma: PrismaService, mongo: MongoDataService);
    private useMongo;
    onModuleInit(): Promise<void>;
    private refresh;
    private ensureFresh;
    get(key: string): Promise<string | null>;
    getJson<T = unknown>(key: string): Promise<T | null>;
    getBool(key: string): Promise<boolean>;
    getBoolDefault(key: string, fallback: boolean): Promise<boolean>;
    getInt(key: string, fallback?: number): Promise<number>;
    getNumber(key: string, fallback: number): Promise<number>;
    getStatus(key: string): Promise<boolean>;
}
