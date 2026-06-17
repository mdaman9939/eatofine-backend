import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MongoDataService } from '../mongo/mongo-data.service';

interface MongoBusinessSettingDoc {
  mysql_id?: number;
  key?: string;
  value?: string | null;
  key_value?: string | null;
}

@Injectable()
export class BusinessSettingsService implements OnModuleInit {
  private cache = new Map<string, string | null>();
  private cachedAt = 0;
  private readonly ttlMs = 30_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mongo: MongoDataService,
  ) {}

  /** Feature flag — when "1", business settings are read from MongoDB. */
  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_BUSINESS_SETTINGS ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  async onModuleInit() {
    // Don't block module init on a refresh failure — settings will load lazily.
    try {
      await this.refresh();
    } catch {
      // ignored: first read after init will retry
    }
  }

  private async refresh() {
    if (this.useMongo()) {
      const rows = await this.mongo.findMany<MongoBusinessSettingDoc>(
        'business_settings',
        {},
        { projection: { key: 1, value: 1, key_value: 1 } },
      );
      this.cache.clear();
      for (const r of rows) {
        const k = r.key;
        if (!k) continue;
        // Prefer `value`; fall back to `key_value` for docs that use that field.
        const v = (r.value ?? r.key_value ?? null) as string | null;
        this.cache.set(k, v);
      }
      this.cachedAt = Date.now();
      return;
    }
    const rows = await this.prisma.business_settings.findMany({
      select: { key: true, value: true },
    });
    this.cache.clear();
    for (const r of rows) this.cache.set(r.key, r.value);
    this.cachedAt = Date.now();
  }

  private async ensureFresh() {
    if (Date.now() - this.cachedAt > this.ttlMs) await this.refresh();
  }

  async get(key: string): Promise<string | null> {
    await this.ensureFresh();
    return this.cache.get(key) ?? null;
  }

  async getJson<T = unknown>(key: string): Promise<T | null> {
    const v = await this.get(key);
    if (v === null || v === undefined) return null;
    try {
      return JSON.parse(v) as T;
    } catch {
      return null;
    }
  }

  async getBool(key: string): Promise<boolean> {
    const v = await this.get(key);
    if (v === null) return false;
    return v === '1' || v === 'true';
  }

  /** Like getBool, but returns `fallback` when the key was never saved. Used by
   *  toggles that should be ON until an admin explicitly turns them off (mirrors
   *  the admin panel, which renders an unsaved toggle as enabled). */
  async getBoolDefault(key: string, fallback: boolean): Promise<boolean> {
    const v = await this.get(key);
    if (v === null) return fallback;
    return v === '1' || v === 'true';
  }

  async getInt(key: string, fallback = 0): Promise<number> {
    const v = await this.get(key);
    if (v === null) return fallback;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : fallback;
  }

  async getStatus(key: string): Promise<boolean> {
    const o = await this.getJson<{ status?: number | string }>(key);
    return o ? o.status === '1' || o.status === 1 : false;
  }
}
