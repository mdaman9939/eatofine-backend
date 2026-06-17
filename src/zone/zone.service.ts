import { Injectable } from '@nestjs/common';
import { MongoDataService } from '../mongo/mongo-data.service';
import { PrismaService } from '../prisma/prisma.service';

export type LatLng = { lat: number; lng: number };

/**
 * Ray-casting point-in-polygon test. Returns true when (lat,lng) lies inside the
 * `poly` ring (an array of {lat,lng} vertices — the zone coverage polygon the
 * admin draws on the map). Longitude is x, latitude is y.
 */
export function pointInPolygon(lat: number, lng: number, poly: LatLng[]): boolean {
  if (!Array.isArray(poly) || poly.length < 3) return false;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = Number(poly[i]?.lng), yi = Number(poly[i]?.lat);
    const xj = Number(poly[j]?.lng), yj = Number(poly[j]?.lat);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const denom = yj - yi || 1e-12;
    const intersect = (yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / denom + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

interface ZoneRecord {
  id: number;
  name: string | null;
  coordinates: LatLng[];
}

interface MongoZone {
  mysql_id?: number;
  name?: string | null;
  status?: boolean | number | null;
  coordinates?: unknown;
}

/** Defensively coerce a stored coordinates value into a LatLng[]. Accepts an
 *  array of {lat,lng} or a JSON string of the same (Prisma stores it as text). */
function parseCoordinates(raw: unknown): LatLng[] {
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(arr)) return [];
  return arr
    .map((p) => ({ lat: Number((p as LatLng)?.lat), lng: Number((p as LatLng)?.lng) }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
}

/**
 * Resolves which delivery zone a geographic point belongs to, by point-in-polygon
 * testing against each zone's drawn coverage area. Shared by:
 *   • config `get-zone-id` (the app sends this as the zoneId header)
 *   • order placement (block ordering from a restaurant outside the buyer's zone)
 *
 * Leniency: if NO zone has a polygon configured yet, geofencing is treated as
 * "not set up" and we fall back to the first active zone — so the platform keeps
 * working exactly as before until the admin actually draws zone boundaries.
 */
@Injectable()
export class ZoneService {
  constructor(
    private readonly mongo: MongoDataService,
    private readonly prisma: PrismaService,
  ) {}

  private useMongo(): boolean {
    const v = (process.env.USE_MONGO_CONFIG ?? '1').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }

  private async loadActiveZones(): Promise<ZoneRecord[]> {
    if (this.useMongo()) {
      const zones = await this.mongo.findMany<MongoZone>('zones', { status: true }, { sort: { mysql_id: 1 } });
      return zones.map((z) => ({
        id: Number(z.mysql_id),
        name: z.name ?? null,
        coordinates: parseCoordinates(z.coordinates),
      }));
    }
    const zones = await this.prisma.zones.findMany({ where: { status: true }, orderBy: { id: 'asc' } });
    return zones.map((z) => ({
      id: Number(z.id),
      name: z.name ?? null,
      coordinates: parseCoordinates((z as { coordinates?: unknown }).coordinates),
    }));
  }

  /**
   * Classify a point against the configured zones.
   *  - `zones`: the zones whose polygon contains the point (or the fallback zone
   *     when geofencing isn't configured).
   *  - `geofencingActive`: true once at least one zone has a real polygon.
   *  - `serviceable`: whether the point is covered by some zone.
   */
  async classifyPoint(lat: number, lng: number): Promise<{
    zones: Array<{ id: number; name: string | null }>;
    geofencingActive: boolean;
    serviceable: boolean;
  }> {
    const all = await this.loadActiveZones();
    const polygonZones = all.filter((z) => z.coordinates.length >= 3);
    const geofencingActive = polygonZones.length > 0;

    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      const matches = polygonZones
        .filter((z) => pointInPolygon(lat, lng, z.coordinates))
        .map((z) => ({ id: z.id, name: z.name }));
      if (matches.length) return { zones: matches, geofencingActive, serviceable: true };
    }

    // No polygon match. If geofencing isn't configured yet, keep the platform
    // working by falling back to the first active zone; otherwise the point is
    // genuinely outside every drawn coverage area → not serviceable.
    if (!geofencingActive) {
      const fb = all[0];
      return { zones: fb ? [{ id: fb.id, name: fb.name }] : [], geofencingActive, serviceable: !!fb };
    }
    return { zones: [], geofencingActive, serviceable: false };
  }

  /** Zone ids whose coverage contains the point (with the same leniency as
   *  classifyPoint). Empty when the point is outside all configured zones. */
  async resolveZoneIds(lat: number, lng: number): Promise<number[]> {
    return (await this.classifyPoint(lat, lng)).zones.map((z) => z.id);
  }
}
