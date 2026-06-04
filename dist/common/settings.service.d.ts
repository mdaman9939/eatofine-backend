import { MongoDataService } from '../mongo/mongo-data.service';
export declare class SettingsService {
    private readonly mongo;
    private cache;
    private prefixCache;
    private readonly TTL_MS;
    constructor(mongo: MongoDataService);
    private useMongo;
    get(key: string): Promise<string | null>;
    getOr(key: string, fallback: string): Promise<string>;
    getBool(key: string, fallback?: boolean): Promise<boolean>;
    getNum(key: string, fallback?: number): Promise<number>;
    getByPrefix(prefix: string): Promise<Record<string, string | null>>;
    invalidate(): void;
}
