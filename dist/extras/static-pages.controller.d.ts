import { BusinessSettingsService } from '../business-settings/business-settings.service';
export declare class StaticPagesController {
    private readonly bs;
    constructor(bs: BusinessSettingsService);
    private page;
    terms(): Promise<{
        value: string | null;
    }>;
    privacy(): Promise<{
        value: string | null;
    }>;
    about(): Promise<{
        value: string | null;
    }>;
    refund(): Promise<{
        value: string | null;
    }>;
    cancellation(): Promise<{
        value: string | null;
    }>;
    shipping(): Promise<{
        value: string | null;
    }>;
}
