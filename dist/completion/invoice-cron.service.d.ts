import { CompletionService } from './completion.service';
export declare class InvoiceCronService {
    private readonly completion;
    private readonly logger;
    constructor(completion: CompletionService);
    runMonthly(): Promise<void>;
}
