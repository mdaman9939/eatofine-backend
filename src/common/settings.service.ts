import { Injectable } from '@nestjs/common';
import { MongoDataService } from '../mongo/mongo-data.service';

/**
 * Centralized read access to the `business_settings` collection with an
 * in-memory cache. The admin panel writes here via the existing
 * /admin/business-settings PATCH endpoint, and every runtime consumer
 * (invoice page, theme, notifications, feature flags, mobile config…)
 * reads through this service.
 *
 * Cache TTL = 30s. The admin save handler can call invalidate() to flush
 * immediately so an edit takes effect on the very next request.
 */
@Injectable()
export class SettingsService {
  private cache: Map<string, { value: string | null; expires: number }> = new Map();
  private prefixCache: Map<string, { rows: Record<string, string | null>; expires: number }> = new Map();
  private readonly TTL_MS = 30_000;

  constructor(private readonly mongo: MongoDataService) {}

  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_ADMIN ?? '').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  /** Read a single setting by key. Returns null if unset. */
  async get(key: string): Promise<string | null> {
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    if (!this.useMongo()) return null;
    const row = await this.mongo.findOne<{ key: string; value: string | null }>('business_settings', { key });
    const value = row?.value ?? null;
    this.cache.set(key, { value, expires: Date.now() + this.TTL_MS });
    return value;
  }

  /** Read with a fallback default. */
  async getOr(key: string, fallback: string): Promise<string> {
    const v = await this.get(key);
    return v ?? fallback;
  }

  /** Read + coerce to boolean. "true"/"1"/"yes"/"on" → true. */
  async getBool(key: string, fallback = false): Promise<boolean> {
    const v = await this.get(key);
    if (v === null) return fallback;
    return /^(true|1|yes|on)$/i.test(v.trim());
  }

  /** Read + coerce to number. */
  async getNum(key: string, fallback = 0): Promise<number> {
    const v = await this.get(key);
    if (v === null) return fallback;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  }

  /** Read every setting whose key starts with the given prefix. Useful for
   *  building a config object like theme.* or login.* in one shot. */
  async getByPrefix(prefix: string): Promise<Record<string, string | null>> {
    const cached = this.prefixCache.get(prefix);
    if (cached && cached.expires > Date.now()) return cached.rows;
    if (!this.useMongo()) return {};
    const escape = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rows = await this.mongo.findMany<{ key: string; value: string | null }>(
      'business_settings', { key: { $regex: `^${escape}` } },
    );
    const obj: Record<string, string | null> = {};
    for (const r of rows) obj[r.key] = r.value;
    this.prefixCache.set(prefix, { rows: obj, expires: Date.now() + this.TTL_MS });
    return obj;
  }

  /** Flush cache — admin calls this after a PATCH so the next read is fresh. */
  invalidate(): void {
    this.cache.clear();
    this.prefixCache.clear();
  }
}
