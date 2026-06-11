import { MongoDataService } from '../mongo/mongo-data.service';
export type PartySlot = 'user_id' | 'vendor_id' | 'delivery_man_id';
export declare function slotForType(type: string | null | undefined): PartySlot | null;
export declare function typeForSlot(slot: PartySlot): string;
export declare function resolveParticipant(mongo: MongoDataService, type: string | null | undefined, id: number): Promise<{
    slot: PartySlot;
    id: number;
} | null>;
export declare function findOrCreateConversation(mongo: MongoDataService, a: {
    slot: PartySlot;
    id: number;
}, b: {
    slot: PartySlot;
    id: number;
}, lastMessage: string): Promise<number>;
export declare function participantProfile(mongo: MongoDataService, slot: PartySlot, id: number, storageFullUrl: (folder: string, file?: string | null) => string | null): Promise<Record<string, unknown>>;
