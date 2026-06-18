import { OrderLifecycleService } from './order-lifecycle.service';
export declare class OrderLifecycleController {
    private readonly lifecycle;
    constructor(lifecycle: OrderLifecycleService);
    runJobs(): Promise<{
        ok: boolean;
        auto_cancelled: number;
        refunds_processed: number;
    }>;
    cron(key?: string): Promise<{
        ok: boolean;
        auto_cancelled: number;
        refunds_processed: number;
    }>;
}
