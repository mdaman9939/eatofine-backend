import { SettlementService } from './settlement.service';
export declare class SettlementController {
    private readonly settlement;
    constructor(settlement: SettlementService);
    list(limit?: string, offset?: string): Promise<{
        total: number;
        items: Record<string, unknown>[];
    }>;
    get(orderId: number): Promise<Record<string, unknown> | null>;
    run(orderId: number): Promise<{
        ok: boolean;
        skipped?: boolean;
        reason?: string;
        settlement?: Record<string, unknown>;
    }>;
    withdraw(body: Parameters<SettlementService['requestWithdrawal']>[0]): Promise<{
        ok: boolean;
        id: number;
    }>;
}
