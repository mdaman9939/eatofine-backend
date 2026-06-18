import { OrderLifecycleService } from './order-lifecycle.service';
export declare class OrderAutoCancelCron {
    private readonly lifecycle;
    private readonly logger;
    private running;
    constructor(lifecycle: OrderLifecycleService);
    run(): Promise<void>;
}
