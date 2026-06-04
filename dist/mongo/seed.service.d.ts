import { MongoDataService } from './mongo-data.service';
export interface SeedReport {
    started_at: string;
    finished_at: string;
    duration_ms: number;
    collections: Record<string, number>;
}
export declare class SeedService {
    private readonly mongo;
    private readonly log;
    constructor(mongo: MongoDataService);
    private indianFirstNames;
    private indianLastNames;
    private restaurantNames;
    private foodNames;
    private cities;
    private random;
    private randomInt;
    private indianPhone;
    private daysAgo;
    topUpOrders(count?: number): Promise<{
        orders: number;
        details: number;
    }>;
    seedPolicyPages(): Promise<{
        inserted: number;
    }>;
    seedConversations(): Promise<{
        conversations: number;
        messages: number;
    }>;
    seedSubscriptionOrders(): Promise<{
        orders: number;
    }>;
    seedAll(): Promise<SeedReport>;
    private seedUsers;
    private seedVendors;
    private seedRestaurants;
    private seedDeliveryMen;
    private seedFoods;
    private seedOrders;
    private seedReviews;
    private seedDMReviews;
    private seedNotifications;
    private seedCoupons;
    private seedCampaigns;
    private seedWalletTransactions;
    private seedAccountTransactions;
    private seedDisbursements;
    private seedWithdrawRequests;
    private seedContactMessages;
    private seedRefunds;
    private seedAddresses;
    private seedWishlists;
    private seedSubscriptions;
    private seedCashbackHistories;
    private seedLoyaltyPoints;
    private seedVendorInvoices;
    private seedCreditNotes;
    private seedFraudFlags;
    private seedVendorPromotions;
    private seedSubmittedDocuments;
    private seedAdvertisements;
}
