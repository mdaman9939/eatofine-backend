import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
export declare class BusinessSettingsService implements OnModuleInit {
    private readonly prisma;
    private cache;
    private cachedAt;
    private readonly ttlMs;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    private refresh;
    private ensureFresh;
    get(key: string): Promise<string | null>;
    getJson<T = unknown>(key: string): Promise<T | null>;
    getBool(key: string): Promise<boolean>;
    getInt(key: string, fallback?: number): Promise<number>;
    getStatus(key: string): Promise<boolean>;
}
