import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BusinessSettingsService implements OnModuleInit {
  private cache = new Map<string, string | null>();
  private cachedAt = 0;
  private readonly ttlMs = 30_000;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.refresh();
  }

  private async refresh() {
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
