import { MongoDataService } from '../mongo/mongo-data.service';
import { PrismaService } from '../prisma/prisma.service';
export type LatLng = {
    lat: number;
    lng: number;
};
export declare function pointInPolygon(lat: number, lng: number, poly: LatLng[]): boolean;
export declare class ZoneService {
    private readonly mongo;
    private readonly prisma;
    constructor(mongo: MongoDataService, prisma: PrismaService);
    private useMongo;
    private loadActiveZones;
    classifyPoint(lat: number, lng: number): Promise<{
        zones: Array<{
            id: number;
            name: string | null;
        }>;
        geofencingActive: boolean;
        serviceable: boolean;
    }>;
    resolveZoneIds(lat: number, lng: number): Promise<number[]>;
}
